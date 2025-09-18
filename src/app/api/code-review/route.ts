import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth';
import { checkUsageLimit, incrementUsage } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 토큰 제한 설정
const MAX_TOKENS_PER_REQUEST = 4000; // 더 작게 설정하여 안전 마진 확보
const MAX_CODE_LENGTH = 8000; // 코드 길이 제한 (8000자)

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    
    // 사용량 체크
    const usageCheck = await checkUsageLimit(user.id, 'code-review');
    if (!usageCheck.allowed) {
      return NextResponse.json({ 
        error: '코드 리뷰 사용량 한도에 도달했습니다.',
        currentUsage: usageCheck.limit - usageCheck.remaining,
        maxLimit: usageCheck.limit,
        resetDate: usageCheck.resetDate
      }, { status: 429 });
    }

    const { code, language, context, description, autoDetectLanguage, reviewScope, detectedLanguage } = await request.json();

    if (!code) {
      return NextResponse.json({ error: '코드가 제공되지 않았습니다.' }, { status: 400 });
    }

    console.log('코드리뷰 API 호출됨');
    console.log('언어:', language);
    console.log('자동 감지:', autoDetectLanguage);
    console.log('검사 범위:', reviewScope);
    console.log('코드 길이:', code.length);
    console.log('파일에서 감지된 언어:', detectedLanguage);

    // 코드가 너무 긴 경우 처리
    let processedCode = code;
    let isTruncated = false;
    
    if (code.length > MAX_CODE_LENGTH) {
      processedCode = code.substring(0, MAX_CODE_LENGTH) + '\n\n... (코드가 너무 길어 일부만 분석됩니다)';
      isTruncated = true;
    }

    // 언어 자동 감지 로직 - 정교한 가중치 기반 시스템
    let finalDetectedLanguage = language;
    if (autoDetectLanguage && !language) {
      // 파일에서 감지된 언어가 있으면 우선 사용
      if (detectedLanguage && detectedLanguage !== 'unknown') {
        finalDetectedLanguage = detectedLanguage;
        console.log('📁 파일에서 감지된 언어 사용:', detectedLanguage);
      } else {
        // 기존 AI 언어 감지 로직 실행
        const codeLower = processedCode.toLowerCase();
        
        // 각 언어별 점수 계산 (가중치 기반)
        const languageScores: { [key: string]: number } = {
          cpp: 0,
          javascript: 0,
          python: 0,
          java: 0,
          csharp: 0,
          php: 0,
          go: 0,
          rust: 0,
          sql: 0,
          html: 0,
          css: 0,
          typescript: 0,
          react: 0,
          vue: 0,
          kotlin: 0,
          swift: 0
        };

        // C++ 패턴 (매우 높은 가중치)
        if (codeLower.includes('#include')) languageScores.cpp += 50;
        if (codeLower.includes('int main')) languageScores.cpp += 40;
        if (codeLower.includes('std::')) languageScores.cpp += 35;
        if (codeLower.includes('namespace')) languageScores.cpp += 30;
        if (codeLower.includes('cout') || codeLower.includes('cin')) languageScores.cpp += 25;
        if (codeLower.includes('printf') || codeLower.includes('scanf')) languageScores.cpp += 25;
        if (codeLower.includes('vector<') || codeLower.includes('string')) languageScores.cpp += 20;
        if (codeLower.includes('class ') && codeLower.includes('public:')) languageScores.cpp += 20;
        if (codeLower.includes('template<')) languageScores.cpp += 20;
        if (codeLower.includes('using namespace')) languageScores.cpp += 15;
        if (codeLower.includes('const ') && codeLower.includes(';')) languageScores.cpp += 10;
        if (codeLower.includes('return 0;')) languageScores.cpp += 10;

        // JavaScript 패턴 (고유한 패턴 우선)
        if (codeLower.includes('console.log')) languageScores.javascript += 45;
        if (codeLower.includes('function') && codeLower.includes('=>')) languageScores.javascript += 40;
        if (codeLower.includes('import ') && codeLower.includes('from')) languageScores.javascript += 35;
        if (codeLower.includes('export ')) languageScores.javascript += 35;
        if (codeLower.includes('const ') && codeLower.includes('=') && !codeLower.includes(';')) languageScores.javascript += 30;
        if (codeLower.includes('let ') && codeLower.includes('=') && !codeLower.includes(';')) languageScores.javascript += 30;
        if (codeLower.includes('var ') && codeLower.includes('=') && !codeLower.includes(';')) languageScores.javascript += 25;
        if (codeLower.includes('document.')) languageScores.javascript += 25;
        if (codeLower.includes('window.')) languageScores.javascript += 20;
        if (codeLower.includes('addEventListener')) languageScores.javascript += 20;
        if (codeLower.includes('fetch(')) languageScores.javascript += 20;
        if (codeLower.includes('async ') || codeLower.includes('await ')) languageScores.javascript += 20;
        if (codeLower.includes('=>') && !codeLower.includes('function')) languageScores.javascript += 15;

        // TypeScript 패턴
        if (codeLower.includes('interface ') || codeLower.includes('type ')) languageScores.typescript += 40;
        if (codeLower.includes(': string') || codeLower.includes(': number') || codeLower.includes(': boolean')) languageScores.typescript += 30;
        if (codeLower.includes('enum ')) languageScores.typescript += 25;
        if (languageScores.javascript > 0) languageScores.typescript += languageScores.javascript * 0.8; // JavaScript 점수의 80% 추가

        // React 패턴
        if (codeLower.includes('import react') || codeLower.includes('from \'react\'')) languageScores.react += 50;
        if (codeLower.includes('usestate') || codeLower.includes('useeffect')) languageScores.react += 40;
        if (codeLower.includes('jsx') || codeLower.includes('tsx')) languageScores.react += 35;
        if (codeLower.includes('return (') && codeLower.includes('<')) languageScores.react += 30;
        if (languageScores.javascript > 0) languageScores.react += languageScores.javascript * 0.6;

        // Python 패턴 (매우 명확한 패턴)
        if (codeLower.includes('def ') && codeLower.includes(':')) languageScores.python += 50;
        if (codeLower.includes('import ') && !codeLower.includes('from')) languageScores.python += 40;
        if (codeLower.includes('from ') && codeLower.includes('import ')) languageScores.python += 40;
        if (codeLower.includes('print(')) languageScores.python += 35;
        if (codeLower.includes('if __name__') && codeLower.includes('__main__')) languageScores.python += 30;
        if (codeLower.includes('class ') && codeLower.includes(':')) languageScores.python += 25;
        if (codeLower.includes('try:') || codeLower.includes('except:')) languageScores.python += 25;
        if (codeLower.includes('with ')) languageScores.python += 20;
        if (codeLower.includes('lambda ')) languageScores.python += 20;
        if (codeLower.includes('self.')) languageScores.python += 20;
        if (codeLower.includes('range(')) languageScores.python += 15;
        if (codeLower.includes('len(')) languageScores.python += 15;

        // Java 패턴
        if (codeLower.includes('public class')) languageScores.java += 50;
        if (codeLower.includes('public static void main')) languageScores.java += 45;
        if (codeLower.includes('system.out.println')) languageScores.java += 40;
        if (codeLower.includes('import java.')) languageScores.java += 35;
        if (codeLower.includes('private ') || codeLower.includes('protected ')) languageScores.java += 30;
        if (codeLower.includes('extends ') || codeLower.includes('implements ')) languageScores.java += 25;
        if (codeLower.includes('@override') || codeLower.includes('@deprecated')) languageScores.java += 25;
        if (codeLower.includes('arraylist<') || codeLower.includes('hashmap<')) languageScores.java += 20;
        if (codeLower.includes('try {') || codeLower.includes('catch (')) languageScores.java += 20;
        if (codeLower.includes('new ')) languageScores.java += 15;

        // C# 패턴
        if (codeLower.includes('using system;')) languageScores.csharp += 50;
        if (codeLower.includes('namespace ')) languageScores.csharp += 40;
        if (codeLower.includes('public class') && codeLower.includes(':')) languageScores.csharp += 35;
        if (codeLower.includes('console.writeline')) languageScores.csharp += 35;
        if (codeLower.includes('var ') && codeLower.includes('=')) languageScores.csharp += 25;
        if (codeLower.includes('foreach ')) languageScores.csharp += 25;
        if (codeLower.includes('linq') || codeLower.includes('select ') || codeLower.includes('where ')) languageScores.csharp += 20;
        if (codeLower.includes('get;') || codeLower.includes('set;')) languageScores.csharp += 20;

        // PHP 패턴
        if (codeLower.includes('<?php')) languageScores.php += 50;
        if (codeLower.includes('?>')) languageScores.php += 40;
        if (codeLower.includes('$') && codeLower.includes('=')) languageScores.php += 35;
        if (codeLower.includes('echo ')) languageScores.php += 30;
        if (codeLower.includes('function ') && codeLower.includes('$')) languageScores.php += 25;
        if (codeLower.includes('array(')) languageScores.php += 20;
        if (codeLower.includes('$_get') || codeLower.includes('$_post')) languageScores.php += 20;

        // Go 패턴
        if (codeLower.includes('package main')) languageScores.go += 50;
        if (codeLower.includes('import (')) languageScores.go += 40;
        if (codeLower.includes('func main(')) languageScores.go += 40;
        if (codeLower.includes('fmt.println')) languageScores.go += 35;
        if (codeLower.includes('var ') && codeLower.includes('string')) languageScores.go += 25;
        if (codeLower.includes('type ') && codeLower.includes('struct')) languageScores.go += 25;
        if (codeLower.includes('defer ')) languageScores.go += 20;
        if (codeLower.includes('range ')) languageScores.go += 20;

        // Rust 패턴
        if (codeLower.includes('fn main(')) languageScores.rust += 50;
        if (codeLower.includes('let mut ')) languageScores.rust += 40;
        if (codeLower.includes('println!')) languageScores.rust += 35;
        if (codeLower.includes('use ')) languageScores.rust += 30;
        if (codeLower.includes('struct ')) languageScores.rust += 25;
        if (codeLower.includes('impl ')) languageScores.rust += 25;
        if (codeLower.includes('option<') || codeLower.includes('result<')) languageScores.rust += 20;

        // SQL 패턴
        if (codeLower.includes('select ') && codeLower.includes('from ')) languageScores.sql += 50;
        if (codeLower.includes('insert into')) languageScores.sql += 45;
        if (codeLower.includes('update ') && codeLower.includes('set ')) languageScores.sql += 45;
        if (codeLower.includes('delete from')) languageScores.sql += 45;
        if (codeLower.includes('create table')) languageScores.sql += 40;
        if (codeLower.includes('where ')) languageScores.sql += 30;
        if (codeLower.includes('order by')) languageScores.sql += 25;
        if (codeLower.includes('group by')) languageScores.sql += 25;
        if (codeLower.includes('join ')) languageScores.sql += 25;

        // HTML 패턴
        if (codeLower.includes('<!doctype html>')) languageScores.html += 50;
        if (codeLower.includes('<html>')) languageScores.html += 40;
        if (codeLower.includes('<head>')) languageScores.html += 35;
        if (codeLower.includes('<body>')) languageScores.html += 35;
        if (codeLower.includes('<div>') || codeLower.includes('</div>')) languageScores.html += 25;
        if (codeLower.includes('<span>') || codeLower.includes('</span>')) languageScores.html += 20;
        if (codeLower.includes('class=')) languageScores.html += 20;
        if (codeLower.includes('id=')) languageScores.html += 20;

        // CSS 패턴
        if (codeLower.includes('{') && codeLower.includes('}') && codeLower.includes(':')) languageScores.css += 40;
        if (codeLower.includes('@media')) languageScores.css += 35;
        if (codeLower.includes('color:') || codeLower.includes('background:')) languageScores.css += 30;
        if (codeLower.includes('margin:') || codeLower.includes('padding:')) languageScores.css += 25;
        if (codeLower.includes('font-size:') || codeLower.includes('font-weight:')) languageScores.css += 25;

        // Vue.js 패턴
        if (codeLower.includes('<template>')) languageScores.vue += 50;
        if (codeLower.includes('<script>')) languageScores.vue += 40;
        if (codeLower.includes('v-if=') || codeLower.includes('v-for=')) languageScores.vue += 35;
        if (codeLower.includes('export default')) languageScores.vue += 30;
        if (languageScores.javascript > 0) languageScores.vue += languageScores.javascript * 0.7;

        // Kotlin 패턴
        if (codeLower.includes('fun main(')) languageScores.kotlin += 50;
        if (codeLower.includes('val ') && codeLower.includes('=')) languageScores.kotlin += 40;
        if (codeLower.includes('var ') && codeLower.includes('=')) languageScores.kotlin += 35;
        if (codeLower.includes('println(')) languageScores.kotlin += 30;
        if (codeLower.includes('when (')) languageScores.kotlin += 25;
        if (codeLower.includes('data class')) languageScores.kotlin += 25;

        // Swift 패턴
        if (codeLower.includes('import foundation')) languageScores.swift += 50;
        if (codeLower.includes('func ')) languageScores.swift += 40;
        if (codeLower.includes('var ') && codeLower.includes(': ')) languageScores.swift += 35;
        if (codeLower.includes('let ') && codeLower.includes(': ')) languageScores.swift += 35;
        if (codeLower.includes('print(')) languageScores.swift += 30;
        if (codeLower.includes('guard ')) languageScores.swift += 25;
        if (codeLower.includes('if let ')) languageScores.swift += 25;

        // 가장 높은 점수의 언어 선택
        const maxScore = Math.max(...Object.values(languageScores));
        const detectedLanguages = Object.entries(languageScores)
          .filter(([, score]) => score === maxScore)
          .map(([lang]) => lang);

        // 점수가 20 이상인 경우에만 감지된 것으로 간주
        if (maxScore >= 20) {
          finalDetectedLanguage = detectedLanguages[0];
          
          // 특별한 경우 처리
          if (detectedLanguages.includes('react')) {
            finalDetectedLanguage = 'react';
          } else if (detectedLanguages.includes('typescript')) {
            finalDetectedLanguage = 'typescript';
          } else if (detectedLanguages.includes('vue')) {
            finalDetectedLanguage = 'vue';
          }
        } else {
          finalDetectedLanguage = 'unknown';
        }

        console.log('🔍 언어 감지 결과:', {
          scores: languageScores,
          detected: finalDetectedLanguage,
          maxScore: maxScore
        });
      }
    }

    // 검사 범위에 따른 프롬프트 조정
    let scopeInstruction = '';
    if (reviewScope) {
      switch (reviewScope) {
        case 'basic':
          scopeInstruction = '기본적인 문법 오류와 코드 스타일만 검사해주세요.';
          break;
        case 'comprehensive':
          scopeInstruction = '전체적인 코드 품질, 성능, 보안을 종합적으로 검사해주세요.';
          break;
        case 'security':
          scopeInstruction = '보안 취약점과 보안 관련 이슈를 중점적으로 검사해주세요.';
          break;
        case 'performance':
          scopeInstruction = '성능 최적화와 효율성을 중점적으로 검사해주세요.';
          break;
        default:
          scopeInstruction = '전체적인 코드 품질을 검사해주세요.';
      }
    }

    const prompt = `
다음 ${finalDetectedLanguage || '코드'}를 분석하여 코드리뷰를 제공해주세요:

${description ? `코드 설명: ${description}\n\n` : ''}
코드:
\`\`\`${finalDetectedLanguage || ''}
${processedCode}
\`\`\`

${context ? `컨텍스트: ${context}\n\n` : ''}
${isTruncated ? '⚠️ 주의: 코드가 너무 길어 일부만 분석됩니다.\n\n' : ''}
${scopeInstruction ? `검사 범위: ${scopeInstruction}\n\n` : ''}

반드시 다음 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요:

{
  "summary": "전체적인 코드 리뷰 요약 (한국어)",
  "scores": {
    "readability": 70,
    "maintainability": 75,
    "performance": 80,
    "security": 60,
    "bestPractices": 70
  },
  "issues": [
    {
      "level": "error",
      "type": "보안 취약점",
      "message": "구체적인 문제 설명",
      "suggestion": "개선 제안"
    }
  ],
  "improvements": ["개선 사항 1", "개선 사항 2"],
  "positives": ["잘된 점 1", "잘된 점 2"],
  "refactoredCode": "개선된 코드 예시 (선택사항)"
}

중요:
- 반드시 유효한 JSON 형식으로만 응답
- 점수는 0-100 사이의 정수
- 보안 취약점 발견 시 security 점수 낮게 설정
- 한국어로 답변
- JSON 외의 다른 텍스트는 절대 포함하지 마세요
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 경험 많은 시니어 개발자입니다. 코드를 분석하고 개선점을 제시하는 코드리뷰 전문가입니다. 반드시 JSON 형식으로 응답해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: MAX_TOKENS_PER_REQUEST,
      temperature: 0.3
    });

    const reviewContent = completion.choices[0]?.message?.content;

    if (!reviewContent) {
      return NextResponse.json({ error: '코드리뷰 생성에 실패했습니다.' }, { status: 500 });
    }

    let reviewData;
    try {
      // JSON 파싱 시도
      reviewData = JSON.parse(reviewContent);
    } catch (error) {
      console.error('JSON 파싱 오류:', error);
      console.log('원본 응답:', reviewContent);
      
      // JSON 파싱 실패 시 기본 구조로 변환
      reviewData = {
        summary: reviewContent,
        scores: {
          readability: 70,
          maintainability: 75,
          performance: 80,
          security: 85,
          bestPractices: 70
        },
        issues: [],
        improvements: [],
        positives: []
      };
    }

    console.log('코드리뷰 생성 완료');

    // 사용량 증가
    await incrementUsage(user.id, 'code-review');

    // 증가된 사용량 정보 가져오기
    const updatedUsageCheck = await checkUsageLimit(user.id, 'code-review');

    return NextResponse.json({
      success: true,
      review: reviewData.summary,
      scores: reviewData.scores,
      issues: reviewData.issues || [],
      improvements: reviewData.improvements || [],
      positives: reviewData.positives || [],
      refactoredCode: reviewData.refactoredCode,
      detectedLanguage: finalDetectedLanguage,
      model: 'gpt-4',
      timestamp: new Date().toISOString(),
      isTruncated: isTruncated,
      originalLength: code.length,
      processedLength: processedCode.length,
      // 사용량 정보 추가
      usage: {
        current: updatedUsageCheck.limit - updatedUsageCheck.remaining,
        limit: updatedUsageCheck.limit,
        remaining: updatedUsageCheck.remaining
      }
    });

  } catch (error) {
    console.error('코드리뷰 처리 중 오류:', error);
    
    // 토큰 제한 오류인 경우 특별한 메시지 반환
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('context_length_exceeded'))) {
      return NextResponse.json(
        { 
          error: '코드가 너무 길어 분석할 수 없습니다.',
          details: '코드를 더 작은 부분으로 나누거나, 중요한 부분만 선택하여 분석해주세요. (최대 8000자까지 지원)'
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: '코드리뷰 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 