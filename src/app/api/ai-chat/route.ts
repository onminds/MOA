import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    // 실제 AI API 호출 (현재는 Mock 응답)
    // TODO: OpenAI, Claude, 또는 다른 AI 서비스 연동
    
    // 메시지 분석 및 응답 생성
    const response = generateAIResponse(message);
    
    return NextResponse.json({
      success: true,
      response: response.content,
      actions: response.actions
    });

  } catch (error) {
    console.error('AI Chat API 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'AI 응답 생성 중 오류가 발생했습니다.' 
      },
      { status: 500 }
    );
  }
}

function generateAIResponse(message: string) {
  const lowerMessage = message.toLowerCase();
  
  // 이메일 관련 응답들
  const responses = {
    // 이메일 정리
    'organize': {
      content: '📧 현재 5개의 이메일이 있습니다. 중요도별로 정리해드릴까요?',
      actions: [
        { label: '중요도별 정리', action: 'organize_by_priority' },
        { label: '날짜별 정리', action: 'organize_by_date' },
        { label: '보낸 사람별 정리', action: 'organize_by_sender' }
      ]
    },
    
    // 긴급 이메일
    'urgent': {
      content: '🚨 긴급 이메일 2개를 발견했습니다. 즉시 확인이 필요합니다.',
      actions: [
        { label: '긴급 이메일 보기', action: 'show_urgent' },
        { label: '마감일 있는 이메일', action: 'show_deadline' },
        { label: '미답변 이메일', action: 'show_unreplied' }
      ]
    },
    
    // 일정 확인
    'plan': {
      content: '📅 오늘의 일정을 확인했습니다. 회의 2개, 마감일 1개가 있습니다.',
      actions: [
        { label: '일정 상세 보기', action: 'show_calendar' },
        { label: '회의 준비', action: 'prepare_meeting' },
        { label: '마감일 알림 설정', action: 'set_deadline_reminder' }
      ]
    },
    
    // 이메일 답장
    'reply': {
      content: '✍️ 이메일 답장을 도와드리겠습니다. 어떤 톤으로 작성하시겠습니까?',
      actions: [
        { label: '전문적으로 답장', action: 'reply_professional' },
        { label: '친근하게 답장', action: 'reply_friendly' },
        { label: '간단히 답장', action: 'reply_brief' }
      ]
    },
    
    // 새 이메일 작성
    'compose': {
      content: '📝 새 이메일 작성을 도와드리겠습니다. 받는 사람과 제목을 알려주세요.',
      actions: [
        { label: '비즈니스 이메일', action: 'compose_business' },
        { label: '개인 이메일', action: 'compose_personal' },
        { label: '공식 이메일', action: 'compose_formal' }
      ]
    },
    
    // 기본 응답
    'default': {
      content: '안녕하세요! 이메일 관리를 도와드리겠습니다. 무엇을 도와드릴까요?',
      actions: [
        { label: '이메일 정리', action: 'organize_inbox' },
        { label: '긴급 이메일 찾기', action: 'find_urgent' },
        { label: '일정 확인', action: 'check_calendar' }
      ]
    }
  };

  // 메시지 분석
  if (lowerMessage.includes('organize') || lowerMessage.includes('inbox')) {
    return responses.organize;
  }
  
  if (lowerMessage.includes('urgent') || lowerMessage.includes('find')) {
    return responses.urgent;
  }
  
  if (lowerMessage.includes('plan') || lowerMessage.includes('day') || lowerMessage.includes('schedule')) {
    return responses.plan;
  }
  
  if (lowerMessage.includes('reply') || lowerMessage.includes('answer')) {
    return responses.reply;
  }
  
  if (lowerMessage.includes('compose') || lowerMessage.includes('write') || lowerMessage.includes('new')) {
    return responses.compose;
  }

  return responses.default;
} 