import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient } from "@prisma/client";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prisma = new PrismaClient();

// AI 티어 타입 정의
type AITier = {
  model: string;
  name: string;
  description: string;
};

// AI 모델 티어 정의
const AI_TIERS: Record<string, AITier> = {
  GUEST: {
    model: 'gpt-3.5-turbo',
    name: '기본 AI',
    description: '빠르고 기본적인 응답'
  },
  USER: {
    model: 'gpt-4o-mini',
    name: '향상된 AI', 
    description: '더 정확하고 상세한 응답'
  },
  PREMIUM: {
    model: 'gpt-4o',
    name: '프리미엄 AI',
    description: '최고 수준의 정확하고 창의적인 응답'
  }
};

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: '메시지가 필요합니다.' },
        { status: 400 }
      );
    }

    // 세션 확인
    const session = await getServerSession(authOptions);
    
    // 사용자 티어 결정
    let userTier: AITier = AI_TIERS.GUEST;
    let isPremium = false;
    let userId = null;

    if (session?.user?.email) {
      // 로그인한 사용자 - 결제 상태 확인
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
          payments: {
            where: { status: 'completed' },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (user) {
        userId = user.id;
        // 최근 결제 내역이 있으면 프리미엄
        isPremium = user.payments.length > 0;
        userTier = isPremium ? AI_TIERS.PREMIUM : AI_TIERS.USER;
      }
    }

    console.log(`AI 채팅 요청 - 티어: ${userTier.name}, 모델: ${userTier.model}`);

    // AI 응답 생성
    const completion = await openai.chat.completions.create({
      model: userTier.model as any,
      messages: [
        {
          role: "system",
          content: getUserSystemPrompt(userTier, isPremium)
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: getMaxTokens(userTier),
      temperature: getTemperature(userTier)
    });

    let response = completion.choices[0].message.content || '';
    
    // 비로그인 사용자에게 로그인 유도 메시지 추가
    if (!session) {
      response = addLoginPromptMessage(response);
    }

    // 사용량 증가 (로그인 사용자만)
    if (userId) {
      try {
        await incrementUsage(userId, 'ai-chat');
      } catch (error) {
        console.error('사용량 증가 오류:', error);
      }
    }

    return NextResponse.json({
      response,
      tier: {
        name: userTier.name,
        description: userTier.description,
        model: userTier.model
      },
      premium: isPremium,
      authenticated: !!session
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 티어별 시스템 프롬프트
function getUserSystemPrompt(tier: AITier, isPremium: boolean): string {
  const basePrompt = "당신은 MOA의 AI 검색 도우미입니다.";
  
  if (tier === AI_TIERS.GUEST) {
    return `${basePrompt} 간단하고 기본적인 답변을 제공해주세요. 가능한 한 짧고 명확하게 답변하세요.`;
  } else if (tier === AI_TIERS.USER) {
    return `${basePrompt} 친근하고 도움이 되는 답변을 제공해주세요. 적절한 수준의 상세함으로 답변하세요.`;
  } else if (tier === AI_TIERS.PREMIUM) {
    return `${basePrompt} 매우 상세하고 창의적이며 전문적인 답변을 제공해주세요. 다양한 관점과 실용적인 조언을 포함하여 최고 품질의 답변을 작성하세요.`;
  }
  
  return basePrompt;
}

// 티어별 최대 토큰 수
function getMaxTokens(tier: AITier): number {
  if (tier === AI_TIERS.GUEST) {
    return 150;  // 짧은 답변
  } else if (tier === AI_TIERS.USER) {
    return 500;  // 보통 길이
  } else if (tier === AI_TIERS.PREMIUM) {
    return 1500; // 상세한 답변
  }
  return 300;
}

// 티어별 창의성 수준
function getTemperature(tier: AITier): number {
  if (tier === AI_TIERS.GUEST) {
    return 0.3; // 일관성 중심
  } else if (tier === AI_TIERS.USER) {
    return 0.7; // 균형
  } else if (tier === AI_TIERS.PREMIUM) {
    return 0.8; // 창의성 중심
  }
  return 0.5;
}

// 비로그인 사용자용 로그인 유도 메시지 추가
function addLoginPromptMessage(response: string): string {
  const loginPrompts = [
    "\n\n💡 **더 정확하고 상세한 답변을 원하시나요?** 로그인하시면 향상된 AI 모델로 더 나은 답변을 받을 수 있어요!",
    "\n\n🎯 **로그인하면 더 스마트한 AI와 대화할 수 있어요!** 지금보다 훨씬 정확하고 창의적인 답변을 경험해보세요.",
    "\n\n✨ **프리미엄 AI 경험을 원하신다면?** 로그인 후 결제하시면 최고급 GPT-4o 모델을 사용하실 수 있습니다!",
    "\n\n🚀 **이것은 기본 AI의 답변이에요.** 로그인하면 더 똑똑한 AI와 대화하실 수 있어요!"
  ];
  
  const randomPrompt = loginPrompts[Math.floor(Math.random() * loginPrompts.length)];
  return response + randomPrompt;
}

// 사용량 증가 함수
async function incrementUsage(userId: string, serviceType: string) {
  try {
    // 오늘 날짜 확인
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 사용량 레코드 찾기 또는 생성
    const usage = await prisma.usage.upsert({
      where: {
        userId_serviceType: {
          userId,
          serviceType
        }
      },
      update: {
        usageCount: {
          increment: 1
        }
      },
      create: {
        userId,
        serviceType,
        usageCount: 1,
        limitCount: 20, // AI 채팅 기본 제한
        resetDate: today
      }
    });

    // 일일 리셋 체크
    const usageDate = new Date(usage.resetDate);
    usageDate.setHours(0, 0, 0, 0);
    
    if (today.getTime() !== usageDate.getTime()) {
      await prisma.usage.update({
        where: { id: usage.id },
        data: {
          usageCount: 1,
          resetDate: today
        }
      });
    }
  } catch (error) {
    console.error('사용량 증가 실패:', error);
    throw error;
  }
} 