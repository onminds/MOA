import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const companyName = formData.get('companyName') as string;
    const jobTitle = formData.get('jobTitle') as string;
    const keyExperience = formData.get('keyExperience') as string;
    const useSearchResults = formData.get('useSearchResults') as string;
    const uploadedFile = formData.get('file') as File | null;

    if (!companyName || !companyName.trim()) {
      return NextResponse.json({ error: '회사명/학교명을 입력해주세요.' }, { status: 400 });
    }

    if (!jobTitle || !jobTitle.trim()) {
      return NextResponse.json({ error: '지원 직무/지원 학과를 입력해주세요.' }, { status: 400 });
    }

    if (!keyExperience || !keyExperience.trim()) {
      return NextResponse.json({ error: '강조할 경험과 핵심 이력을 입력해주세요.' }, { status: 400 });
    }

    console.log('자기소개서 생성 시작:', { companyName, jobTitle, keyExperience });

    // 파일 내용 추출 (있는 경우)
    let fileContent = '';
    if (uploadedFile) {
      try {
        const fileText = await uploadedFile.text();
        fileContent = `첨부된 파일 내용:\n${fileText}\n\n`;
      } catch (error) {
        console.error('파일 읽기 오류:', error);
        fileContent = '파일을 읽을 수 없습니다.\n\n';
      }
    }

    const coverLetterContent = await generateCoverLetter({
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      keyExperience: keyExperience.trim(),
      useSearchResults: useSearchResults === 'true',
      fileContent,
    });

    return NextResponse.json({ coverLetterContent });
  } catch (error) {
    console.error('자기소개서 생성 오류:', error);
    return NextResponse.json({ error: '자기소개서 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function generateCoverLetter({
  companyName,
  jobTitle,
  keyExperience,
  useSearchResults,
  fileContent,
}: {
  companyName: string;
  jobTitle: string;
  keyExperience: string;
  useSearchResults: boolean;
  fileContent: string;
}): Promise<string> {
  const systemPrompt = `당신은 전문적인 자기소개서 작성 AI입니다. 사용자가 제공한 정보를 바탕으로 매력적이고 설득력 있는 자기소개서를 작성해주세요.

작성 규칙:
1. 한국형 자기소개서 형식을 따르되, 현대적이고 전문적인 톤 유지
2. 지원 회사/학교와 직무/학과에 특화된 맞춤형 내용 작성
3. 사용자가 강조한 경험과 이력을 중심으로 구성
4. 구체적인 성과와 수치를 포함하여 신뢰성 확보
5. 지원 동기와 입사/입학 후 계획을 명확히 제시
6. 개인적이면서도 전문적인 어조 유지
7. 최소 800자 이상으로 상세하게 작성
8. 이모지나 특수문자는 사용하지 않음
9. 마크다운 형식은 사용하지 않고 일반 텍스트로 작성
10. 다음 5개 섹션으로 구성:
    - 첫 번째: 간결하고 흥미로운 시작
    - 두 번째: 성장 배경과 가치관
    - 세 번째: 주요 경험과 역량
    - 네 번째: 지원 동기와 비전
    - 다섯 번째: 마무리와 다짐

${useSearchResults ? '인터넷 검색 결과를 활용하여 지원 회사/학교의 최신 정보와 트렌드를 반영해주세요.' : ''}
${fileContent ? `다음 첨부 파일의 내용을 참고하여 자기소개서를 작성해주세요:\n${fileContent}` : ''}

자기소개서 작성 시 주의사항:
- 구체적인 경험과 성과를 포함
- 지원 직무/학과와의 연관성을 명확히 제시
- 개인적인 스토리와 전문성을 조화롭게 표현
- 진정성 있고 설득력 있는 내용으로 구성
- 지원 회사/학교의 가치관과 문화를 고려
- 미래 계획과 비전을 구체적으로 제시`;

  const userPrompt = `다음 정보를 바탕으로 전문적인 자기소개서를 작성해주세요:

지원 회사/학교: ${companyName}
지원 직무/학과: ${jobTitle}
강조할 경험과 핵심 이력: ${keyExperience}

${useSearchResults ? '지원 회사/학교의 최신 정보를 검색하여 반영해주세요.' : ''}
${fileContent ? '첨부된 파일의 내용을 참고하여 작성해주세요.' : ''}

자기소개서는 다음 5개 섹션으로 작성해주세요:

1. 첫 번째: 간결하고 흥미로운 시작 (150자 내외)
   - 독자의 관심을 끌 수 있는 임팩트 있는 첫 문단
   - 자기소개서의 전체적인 톤을 설정
   - 간결하면서도 매력적인 시작

2. 두 번째: 성장 배경과 가치관 (200자 내외)
   - 본인의 성장 과정과 배경
   - 현재 가지고 있는 가치관과 인생관
   - 개인적인 스토리와 철학

3. 세 번째: 주요 경험과 역량 (250자 내외)
   - 강조할 경험과 핵심 이력을 중심으로
   - 구체적인 성과와 수치 포함
   - 해당 분야에서의 역량과 잠재력

4. 네 번째: 지원 동기와 비전 (200자 내외)
   - 해당 회사/학교를 지원하게 된 구체적인 동기
   - 앞으로의 계획과 비전
   - 회사/학교에 기여할 수 있는 방안

5. 다섯 번째: 마무리와 다짐 (100자 내외)
   - 진정성 있는 마무리
   - 선발되었을 때 보여줄 다짐과 의지
   - 기회를 주시면 최선을 다하겠다는 약속

특별 주의사항:
- 각 섹션이 자연스럽게 연결되도록 구성
- 구체적이고 설득력 있는 내용으로 작성
- 개인적인 경험을 바탕으로 한 진정성 있는 스토리
- 지원 회사/학교의 특성과 문화를 고려한 맞춤형 내용
- 전문적이면서도 개인적인 톤 유지
- 최소 800자 이상으로 상세하게 작성

자기소개서는 지원자의 개성과 역량이 잘 드러나도록 작성해주세요.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '';
    
    if (!content.trim()) {
      throw new Error('자기소개서 내용을 생성하지 못했습니다.');
    }

    return content;
  } catch (error) {
    console.error('OpenAI API 오류:', error);
    throw new Error('자기소개서 생성 중 오류가 발생했습니다.');
  }
} 