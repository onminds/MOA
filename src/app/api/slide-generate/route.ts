import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 템플릿 로드 함수
async function loadTemplate(templateName: string): Promise<string> {
  try {
    const templatePath = path.join(process.cwd(), 'src', 'templates', `${templateName}.html`);
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    return templateContent;
  } catch (error) {
    console.error(`템플릿 로드 실패: ${templateName}`, error);
    throw new Error(`템플릿을 로드할 수 없습니다: ${templateName}`);
  }
}

// 템플릿에서 프롬프트 추출 함수
function extractPromptFromTemplate(templateContent: string): string | null {
  const promptMatch = templateContent.match(/<meta name="template-prompt" content="([^"]+)"/);
  return promptMatch ? promptMatch[1] : null;
}

// 목차에서 제목 추출 함수
function extractTocTitles(tocHtml: string): string[] {
  const tocMatches = tocHtml.match(/<div class="toc-item">(\d+\.\s*[^<]+)<\/div>/g);
  if (!tocMatches) return [];
  
  return tocMatches.map(match => {
    const titleMatch = match.match(/>(\d+\.\s*[^<]+)</);
    return titleMatch ? titleMatch[1].replace(/^\d+\.\s*/, '') : '';
  }).filter(title => title.length > 0);
}

// 임시 저장소 (실제 프로덕션에서는 Redis나 DB 사용 권장)
const tocStorage = new Map<string, string[]>();

export async function POST(request: NextRequest) {
  try {
    const { topic, slideCount = 5, section = 1 } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: '주제가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('🎯 PPT 생성 시작');
    console.log('📝 주제:', topic);
    console.log('📊 총 섹션 수:', slideCount);
    console.log('📍 현재 섹션:', section);

    // 1단계: 주제로 PPT 대본 생성
    const scriptPrompt = `[주제: ${topic}]로 ${slideCount}개의 카드 섹션으로 구성된 PPT 대본을 만들어줘.

    요구사항:
    1. 각 카드 섹션은 "1카드 섹션", "2카드 섹션" 형식으로 구분
    2. 각 섹션은 제목, 내용, 키포인트를 포함
    3. 전문적이고 구조화된 내용으로 작성
    4. 한국어로 작성
    
    형식:
    1카드 섹션
    제목: [제목]
    내용: [상세 내용]
    키포인트: [핵심 포인트 3개]
    
    2카드 섹션
    제목: [제목]
    내용: [상세 내용]
    키포인트: [핵심 포인트 3개]
    
    ... (${slideCount}개까지)`;

    const scriptCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 전문적인 프레젠테이션 대본 작성자입니다. 주어진 주제에 대해 구조화된 PPT 대본을 작성해주세요."
        },
        {
          role: "user",
          content: scriptPrompt
        }
      ],
      temperature: 0.7,
    });

    const scriptContent = scriptCompletion.choices[0]?.message?.content;
    
    if (!scriptContent) {
      throw new Error('PPT 대본 생성에 실패했습니다.');
    }

    // 2단계: 특정 섹션만 추출
    const sectionRegex = new RegExp(`${section}카드 섹션\\s*\\n제목:\\s*([^\\n]+)\\s*\\n내용:\\s*([^\\n]+)\\s*\\n키포인트:\\s*([^\\n]+)`, 'i');
    const sectionMatch = scriptContent.match(sectionRegex);

    if (!sectionMatch) {
      throw new Error(`${section}카드 섹션을 찾을 수 없습니다.`);
    }

    const sectionTitle = sectionMatch[1].trim();
    const sectionContent = sectionMatch[2].trim();
    const sectionKeypoints = sectionMatch[3].trim().split(',').map(point => point.trim());

    // 3단계: HTML 생성
    let contentPrompt = '';
    
    // 템플릿 이름 결정
    let templateName = 'template1';
    if (section === 1) {
      templateName = 'Modern company/template1';
    } else if (section === 2) {
      templateName = 'Modern company/template2';
    } else if (section === 3) {
      templateName = 'Modern company/template3';
    } else if (section === 4) {
      templateName = 'Modern company/template4';
    } else if (section === 5) {
      templateName = 'Modern company/template5';
    }
    
    // 템플릿 로드
    const templateContent = await loadTemplate(templateName);
    
    // 템플릿에서 프롬프트 추출
    const templatePrompt = extractPromptFromTemplate(templateContent);
    
    if (templatePrompt) {
      // 템플릿에서 추출한 프롬프트 사용
      contentPrompt = templatePrompt
        .replace(/{{SECTION_TITLE}}/g, sectionTitle)
        .replace(/{{SECTION_CONTENT}}/g, sectionContent)
        .replace(/{{SECTION_KEYPOINTS}}/g, sectionKeypoints.join(', '));
    } else {
      // 기본 프롬프트 (fallback)
      contentPrompt = `다음 내용을 바탕으로 슬라이드에 적합한 내용을 만들어줘:

      제목: ${sectionTitle}
      내용: ${sectionContent}
      키포인트: ${sectionKeypoints.join(', ')}

      요구사항:
      1. 제목은 간결하고 임팩트 있게 만들어주세요
      2. 내용은 슬라이드에 적합한 길이로 요약해주세요 (2-3문장)
      3. 키포인트는 3-5개로 정리해주세요
      4. 각 키포인트는 "•" 불릿 포인트로 시작해주세요
      5. 줄바꿈은 <br/> 태그를 사용해주세요
      6. 내용과 키포인트를 하나의 텍스트로 합쳐주세요

      내용만 출력해주세요. 다른 설명은 포함하지 마세요.`;
    }

    const contentCompletion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 프레젠테이션 슬라이드 내용 전문가입니다. 주어진 내용을 슬라이드에 적합한 형태로 정리해주세요."
        },
        {
          role: "user",
          content: contentPrompt
        }
      ],
      temperature: 0.7,
    });

    const slideContent = contentCompletion.choices[0]?.message?.content;

    if (!slideContent) {
      throw new Error('슬라이드 내용 생성에 실패했습니다.');
    }

    // 템플릿 로드 및 내용 삽입
    let htmlContent = '';
    if (section === 1) {
      // 섹션 1: 제목 + 부제목
      htmlContent = templateContent
        .replace(/{{TITLE}}/g, sectionTitle)
        .replace(/{{CONTENT}}/g, slideContent)
        .replace(/{{HEADER_LEFT}}/g, '인공지능 미래 연구소')
        .replace(/{{HEADER_CENTER}}/g, '2025.08.05')
        .replace(/{{HEADER_RIGHT}}/g, '@ai_future_lab');
    } else if (section === 2) {
      // 섹션 2: 목차
      // GPT 응답에서 목차 HTML만 추출
      const tocMatch = slideContent.match(/<div class="toc-item">[\s\S]*?<\/div>/g);
      
      let tocContent = '';
      if (tocMatch && tocMatch.length >= 10) {
        // GPT가 올바른 형식으로 응답한 경우
        tocContent = tocMatch.slice(0, 10).join('\n');
      } else {
        // 파싱 실패 시 기본 목차 생성
        const topicKeywords = sectionKeypoints.length > 0 ? sectionKeypoints : ['기본 개념', '주요 특징', '현황 분석'];
        tocContent = `
<div class="toc-item">01. ${sectionTitle}의 기본 개념</div>
<div class="toc-item">02. 주요 특징과 구성요소</div>
<div class="toc-item">03. 현재 상황과 동향</div>
<div class="toc-item">04. 핵심 기술과 방법론</div>
<div class="toc-item">05. 실제 적용 사례</div>
<div class="toc-item">06. 산업별 활용 현황</div>
<div class="toc-item">07. 시장 전망과 기회</div>
<div class="toc-item">08. 도전과제와 해결방안</div>
<div class="toc-item">09. 미래 발전 방향</div>
<div class="toc-item">10. 결론 및 시사점</div>`.trim();
      }
      
      // 목차에서 제목들 추출하고 저장
      const tocTitles = extractTocTitles(tocContent);
      const storageKey = `${topic}_${slideCount}`;
      tocStorage.set(storageKey, tocTitles);
      
      console.log('🔍 2번 슬라이드 파싱 결과:');
      console.log('원본 응답:', slideContent);
      console.log('목차 내용:', tocContent);
      console.log('추출된 제목들:', tocTitles);
      
      htmlContent = templateContent
        .replace(/{{TITLE}}/g, '목차')
        .replace(/{{CONTENT}}/g, tocContent)
        .replace(/{{HEADER_LEFT}}/g, 'AI 미래 전망')
        .replace(/{{HEADER_CENTER}}/g, '2025-08-05')
        .replace(/{{HEADER_RIGHT}}/g, '@aifuture2025');
    } else if (section === 3) {
      // 섹션 3: 통계 + 트렌드
      // 목차에서 제목 가져오기 (3번 = 목차의 1번째 항목)
      const storageKey = `${topic}_${slideCount}`;
      const tocTitles = tocStorage.get(storageKey) || [];
      const tocTitle = tocTitles[0] || `${sectionTitle}의 통계 및 트렌드`; // 목차 1번째 항목
      
      console.log('🔍 3번 슬라이드 원본 GPT 응답:');
      console.log('==================================================');
      console.log(slideContent);
      console.log('==================================================');
      
      // GPT 응답에서 각 부분을 파싱
      const titleMatch = slideContent.match(/TITLE:\s*(.+?)(?:\n|DESCRIPTION|$)/);
      const descriptionMatch = slideContent.match(/DESCRIPTION:\s*([\s\S]+?)(?:\nTRENDS|$)/);
      const trendsMatch = slideContent.match(/TRENDS:\s*([\s\S]+?)(?:\nSTATS|$)/);
      const statsMatch = slideContent.match(/STATS:\s*([\s\S]+?)(?:\n[A-Z]+:|$)/);
      
      console.log('🔍 파싱 결과:');
      console.log('titleMatch:', titleMatch);
      console.log('descriptionMatch:', descriptionMatch);
      console.log('trendsMatch:', trendsMatch);
      console.log('statsMatch:', statsMatch);
      
      const title = tocTitle; // 목차 제목 사용
      const description = descriptionMatch && descriptionMatch[1].trim().length > 10 ? 
        descriptionMatch[1].trim() : 
        `${tocTitle}에 대한 분석을 통해 현재 동향과 미래 전망을 살펴보겠습니다. 데이터 기반의 인사이트를 통해 핵심 트렌드와 주요 통계를 확인할 수 있습니다.`;
      
      const trends = trendsMatch && trendsMatch[1].trim().length > 20 ? 
        trendsMatch[1].trim() : 
        `<li>${tocTitle} 관련 발전</li><li>시장 규모 확대</li><li>사용자 채택 증가</li><li>미래 전망 긍정적</li>`;
      
      // STATS 파싱 강화
      let stats = '';
      if (statsMatch && statsMatch[1].trim().length > 50) {
        stats = statsMatch[1].trim();
        console.log('✅ STATS 파싱 성공:', stats);
      } else {
        // 주제에 맞는 동적 통계 데이터로 폴백
        stats = `<div class="stat-item"><div class="stat-arrow"><i class="fas fa-arrow-up"></i></div><div class="stat-number">72%</div><div class="stat-text">${tocTitle} 성장률<br/>전년 대비 증가</div></div><div class="stat-item"><div class="stat-arrow"><i class="fas fa-chart-line"></i></div><div class="stat-number">3.2배</div><div class="stat-text">${tocTitle} 효율성<br/>도입 후 개선</div></div>`;
        console.log('⚠️ STATS 파싱 실패, 폴백 사용:', stats);
      }
      
      // 트렌드가 비어있지 않은지 확인
      const finalTrends = trends && trends.length > 10 ? trends : 
        `<li>${tocTitle} 기술 혁신</li><li>산업 적용 확산</li><li>투자 증가</li><li>글로벌 성장</li>`;
      
      // 최종 통계 데이터 확인
      const finalStats = stats && stats.length > 50 ? stats :
        `<div class="stat-item"><div class="stat-arrow"><i class="fas fa-arrow-up"></i></div><div class="stat-number">78%</div><div class="stat-text">${tocTitle} 도입률<br/>2024년 기준</div></div><div class="stat-item"><div class="stat-arrow"><i class="fas fa-chart-line"></i></div><div class="stat-number">2.8배</div><div class="stat-text">${tocTitle} 생산성<br/>평균 향상률</div></div>`;
      
      console.log('🔍 3번 슬라이드 파싱 결과:');
      console.log('목차 제목:', tocTitle);
      console.log('제목:', title);
      console.log('설명:', description);
      console.log('트렌드:', finalTrends);
      console.log('최종 통계:', finalStats);
      
      htmlContent = templateContent
        .replace(/{{TITLE}}/g, title)
        .replace(/{{DESCRIPTION}}/g, description)
        .replace(/{{TRENDS}}/g, finalTrends)
        .replace(/{{STATS}}/g, finalStats)
        .replace(/{{HEADER_LEFT}}/g, '인공지능 미래보고서')
        .replace(/{{HEADER_CENTER}}/g, '2025년 8월')
        .replace(/{{HEADER_RIGHT}}/g, '@AI연구센터');
    } else if (section === 4) {
      // 섹션 4: 우선순위 원형
      // 목차에서 제목 가져오기 (4번 = 목차의 2번째 항목)
      const storageKey = `${topic}_${slideCount}`;
      const tocTitles = tocStorage.get(storageKey) || [];
      const tocTitle = tocTitles[1] || `${sectionTitle}의 우선순위 분석`; // 목차 2번째 항목
      
      // GPT 응답에서 각 부분을 파싱
      const headerLeftMatch = slideContent.match(/HEADER_LEFT:\s*(.+?)(?:\n|$)/);
      const headerCenterMatch = slideContent.match(/HEADER_CENTER:\s*(.+?)(?:\n|$)/);
      const headerRightMatch = slideContent.match(/HEADER_RIGHT:\s*(.+?)(?:\n|$)/);
      const titleMatch = slideContent.match(/TITLE:\s*(.+?)(?:\n|$)/);
      const subtitleMatch = slideContent.match(/SUBTITLE:\s*(.+?)(?:\n|$)/);
      const descriptionMatch = slideContent.match(/DESCRIPTION:\s*(.+?)(?:\n|$)/);
      const priorityCirclesMatch = slideContent.match(/PRIORITY_CIRCLES:\s*([\s\S]*?)(?:\n|$)/);
      
      const headerLeft = headerLeftMatch ? headerLeftMatch[1].trim() : `${tocTitle} 분석 보고서`;
      const headerCenter = headerCenterMatch ? headerCenterMatch[1].trim() : '2025.08.05';
      const headerRight = headerRightMatch ? headerRightMatch[1].trim() : 'AI 연구소';
      const title = tocTitle; // 목차 제목 사용
      const subtitle = subtitleMatch && subtitleMatch[1].trim().length > 5 ? 
        subtitleMatch[1].trim() : 
        `${tocTitle}의 핵심 요소`;
      const description = descriptionMatch && descriptionMatch[1].trim().length > 20 ? 
        descriptionMatch[1].trim() : 
        `${tocTitle}에 대한 체계적인 분석을 통해 핵심 요소들을 파악해보겠습니다. 다음 세 가지 우선순위를 통해 주요 특징과 발전 방향을 살펴보겠습니다. 각 요소는 상호 연관성을 가지며 전체적인 발전에 기여하고 있습니다.`;
      const priorityCircles = priorityCirclesMatch && priorityCirclesMatch[1].trim().length > 100 ? 
        priorityCirclesMatch[1].trim() : 
        `<div class="priority-circle priority-1"><div class="priority-number">01</div><div class="priority-text">기본 개념</div></div><div class="priority-circle priority-2"><div class="priority-number">02</div><div class="priority-text">핵심 기술</div></div><div class="priority-circle priority-3"><div class="priority-number">03</div><div class="priority-text">미래 전망</div></div>`;
      
      // 우선순위 원형이 비어있지 않은지 확인
      const finalPriorityCircles = priorityCircles && priorityCircles.length > 50 ? priorityCircles :
        `<div class="priority-circle priority-1"><div class="priority-number">01</div><div class="priority-text">${tocTitle} 기초</div></div><div class="priority-circle priority-2"><div class="priority-number">02</div><div class="priority-text">핵심 구성요소</div></div><div class="priority-circle priority-3"><div class="priority-number">03</div><div class="priority-text">발전 방향</div></div>`;
      
      console.log('🔍 4번 슬라이드 파싱 결과:');
      console.log('목차 제목:', tocTitle);
      console.log('원본 응답:', slideContent);
      console.log('제목:', title);
      console.log('부제목:', subtitle);
      console.log('설명:', description);
      console.log('우선순위 원형:', finalPriorityCircles);
      
      htmlContent = templateContent
        .replace(/{{TITLE}}/g, title)
        .replace(/{{SUBTITLE}}/g, subtitle)
        .replace(/{{DESCRIPTION}}/g, description)
        .replace(/{{PRIORITY_CIRCLES}}/g, finalPriorityCircles)
        .replace(/{{HEADER_LEFT}}/g, headerLeft)
        .replace(/{{HEADER_CENTER}}/g, headerCenter)
        .replace(/{{HEADER_RIGHT}}/g, headerRight);
    } else if (section === 5) {
      // 섹션 5: 게이지 + 차트
      // 목차에서 제목 가져오기 (5번 = 목차의 3번째 항목)
      const storageKey = `${topic}_${slideCount}`;
      const tocTitles = tocStorage.get(storageKey) || [];
      const tocTitle = tocTitles[2] || `${sectionTitle}의 성과 지표`; // 목차 3번째 항목
      
      // GPT 응답에서 각 부분을 파싱
      const headerLeftMatch = slideContent.match(/HEADER_LEFT:\s*(.+?)(?:\n|$)/);
      const headerCenterMatch = slideContent.match(/HEADER_CENTER:\s*(.+?)(?:\n|$)/);
      const headerRightMatch = slideContent.match(/HEADER_RIGHT:\s*(.+?)(?:\n|$)/);
      const titleMatch = slideContent.match(/TITLE:\s*(.+?)(?:\n|$)/);
      const descriptionMatch = slideContent.match(/DESCRIPTION:\s*(.+?)(?:\n|$)/);
      const gaugeValueMatch = slideContent.match(/GAUGE_VALUE:\s*(.+?)(?:\n|$)/);
      const gaugeDescriptionMatch = slideContent.match(/GAUGE_DESCRIPTION:\s*(.+?)(?:\n|$)/);
      const statValueMatch = slideContent.match(/STAT_VALUE:\s*(.+?)(?:\n|$)/);
      const statDescriptionMatch = slideContent.match(/STAT_DESCRIPTION:\s*(.+?)(?:\n|$)/);
      
      const headerLeft = headerLeftMatch ? headerLeftMatch[1].trim() : `${tocTitle} 연구소`;
      const headerCenter = headerCenterMatch ? headerCenterMatch[1].trim() : '2025.08.05';
      const headerRight = headerRightMatch ? headerRightMatch[1].trim() : '@future2025';
      const title = tocTitle; // 목차 제목 사용
      const description = descriptionMatch && descriptionMatch[1].trim().length > 20 ? 
        descriptionMatch[1].trim() : 
        `${tocTitle}의 발전으로 다양한 분야에서 혁신적인 변화가 일어나고 있습니다. 시장 규모와 채택률이 지속적으로 증가하며 새로운 기회를 창출하고 있습니다.`;
      const gaugeValue = gaugeValueMatch && gaugeValueMatch[1].trim().length > 1 ? 
        gaugeValueMatch[1].trim() : 
        '72%';
      const gaugeDescription = gaugeDescriptionMatch && gaugeDescriptionMatch[1].trim().length > 10 ? 
        gaugeDescriptionMatch[1].trim() : 
        `${tocTitle} 도입률이 꾸준히 증가하며 2025년까지 72%의 기업이 관련 기술을 활용할 것으로 전망됩니다.`;
      const statValue = statValueMatch && statValueMatch[1].trim().length > 1 ? 
        statValueMatch[1].trim() : 
        '2.8배';
      const statDescription = statDescriptionMatch && statDescriptionMatch[1].trim().length > 10 ? 
        statDescriptionMatch[1].trim() : 
        `${tocTitle}을 도입한 기업의 평균 효율성 향상률로, 기존 대비 2.8배의 성과 개선을 보여줍니다.`;
      
      // 최종 안전장치
      const finalGaugeValue = gaugeValue && gaugeValue.length > 0 ? gaugeValue : '68%';
      const finalGaugeDescription = gaugeDescription && gaugeDescription.length > 10 ? gaugeDescription : 
        '시장 성장률이 지속적으로 증가하며 긍정적인 전망을 보이고 있습니다.';
      const finalStatValue = statValue && statValue.length > 0 ? statValue : '3.5배';
      const finalStatDescription = statDescription && statDescription.length > 10 ? statDescription :
        '도입 후 평균 생산성 향상률로 뛰어난 성과를 보여주고 있습니다.';
      
      console.log('🔍 5번 슬라이드 파싱 결과:');
      console.log('목차 제목:', tocTitle);
      console.log('원본 응답:', slideContent);
      console.log('제목:', title);
      console.log('설명:', description);
      console.log('게이지 값:', finalGaugeValue);
      console.log('게이지 설명:', finalGaugeDescription);
      console.log('통계 값:', finalStatValue);
      console.log('통계 설명:', finalStatDescription);
      
      htmlContent = templateContent
        .replace(/{{TITLE}}/g, title)
        .replace(/{{DESCRIPTION}}/g, description)
        .replace(/{{GAUGE_VALUE}}/g, finalGaugeValue)
        .replace(/{{GAUGE_DESCRIPTION}}/g, finalGaugeDescription)
        .replace(/{{STAT_VALUE}}/g, finalStatValue)
        .replace(/{{STAT_DESCRIPTION}}/g, finalStatDescription)
        .replace(/{{HEADER_LEFT}}/g, headerLeft)
        .replace(/{{HEADER_CENTER}}/g, headerCenter)
        .replace(/{{HEADER_RIGHT}}/g, headerRight);
    } else {
      // 일반 섹션: 일반 형식으로 처리
      htmlContent = templateContent
        .replace(/{{TITLE}}/g, sectionTitle)
        .replace(/{{CONTENT}}/g, slideContent)
        .replace(/{{HEADER_LEFT}}/g, 'AI 미래 전망')
        .replace(/{{HEADER_CENTER}}/g, '2025-08-05')
        .replace(/{{HEADER_RIGHT}}/g, '@aifuture2025');
    }

    console.log('✅ HTML 생성 완료!');

    return NextResponse.json({ 
      html: htmlContent,
      format: 'html',
      topic: topic,
      section: section,
      totalSections: slideCount,
      script: scriptContent
    });

  } catch (error) {
    console.error('❌ 슬라이드 생성 오류:', error);
    return NextResponse.json(
      { error: '슬라이드 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 