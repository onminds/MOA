import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { YoutubeTranscript } from 'youtube-transcript';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import YoutubeTranscriptApi from 'youtube-transcript-api';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import puppeteer from 'puppeteer';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import mammoth from 'mammoth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const type = formData.get('type') as string;

    let content = '';

    switch (type) {
      case 'youtube':
        const youtubeUrl = formData.get('youtubeUrl') as string;
        content = await extractYouTubeContent(youtubeUrl);
        break;
      
      case 'document':
        const document = formData.get('document') as File;
        content = await extractDocumentContent(document);
        break;
      
      case 'website':
        const websiteUrl = formData.get('websiteUrl') as string;
        content = await extractWebsiteContent(websiteUrl);
        break;
      
      case 'text':
        content = formData.get('textContent') as string;
        break;
      
      default:
        return NextResponse.json({ error: '지원하지 않는 타입입니다.' }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: '내용을 추출할 수 없습니다.' }, { status: 400 });
    }

    // OpenAI를 사용하여 요약 생성 (타입별로 다른 프롬프트 사용)
    const summary = await generateSummary(content, type);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('요약 생성 오류:', error);
    return NextResponse.json({ error: '요약 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function extractYouTubeContent(url: string): Promise<string> {
  try {
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('유효하지 않은 YouTube URL입니다.');
    }

    console.log('YouTube Video ID:', videoId);

    // 방법 1: 기본 자막 추출 (가장 일반적인 방법)
    try {
      console.log('기본 자막 추출 시도...');
      const transcripts = await YoutubeTranscript.fetchTranscript(videoId);
      
      console.log('기본 자막 결과:', transcripts);
      console.log('기본 자막 길이:', transcripts?.length);
      
      if (transcripts && transcripts.length > 0) {
        const transcriptText = transcripts
          .map((item: { text: string }) => item.text)
          .join(' ');
        
        console.log('기본 자막 추출 성공:', transcriptText.length, '문자');
        console.log('자막 샘플:', transcriptText.substring(0, 200));
        return `YouTube 영상 자막:\n\n${transcriptText}`;
      } else {
        console.log('기본 자막이 비어있거나 없습니다.');
      }
    } catch (transcriptError) {
      console.log('기본 자막 추출 실패:', transcriptError instanceof Error ? transcriptError.message : '알 수 없는 오류');
    }

    // 방법 2: 한국어 자막 시도
    try {
      console.log('한국어 자막 추출 시도...');
      const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'ko'
      });
      
      console.log('한국어 자막 결과:', transcripts);
      console.log('한국어 자막 길이:', transcripts?.length);
      
      if (transcripts && transcripts.length > 0) {
        const transcriptText = transcripts
          .map((item: { text: string }) => item.text)
          .join(' ');
        
        console.log('한국어 자막 추출 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (한국어):\n\n${transcriptText}`;
      } else {
        console.log('한국어 자막이 비어있거나 없습니다.');
      }
    } catch (koTranscriptError) {
      console.log('한국어 자막 추출 실패:', koTranscriptError instanceof Error ? koTranscriptError.message : '알 수 없는 오류');
    }

    // 방법 3: 영어 자막 시도
    try {
      console.log('영어 자막 추출 시도...');
      const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'en'
      });
      
      if (transcripts && transcripts.length > 0) {
        const transcriptText = transcripts
          .map((item: { text: string }) => item.text)
          .join(' ');
        
        console.log('영어 자막 추출 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (영어):\n\n${transcriptText}`;
      }
    } catch (enTranscriptError) {
      console.log('영어 자막 추출 실패:', enTranscriptError instanceof Error ? enTranscriptError.message : '알 수 없는 오류');
    }

    // 방법 4: 자동 생성된 자막 시도
    try {
      console.log('자동 생성 자막 추출 시도...');
      const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'ko'
      });
      
      if (transcripts && transcripts.length > 0) {
        const transcriptText = transcripts
          .map((item: { text: string }) => item.text)
          .join(' ');
        
        console.log('자동 생성 자막 추출 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (자동 생성):\n\n${transcriptText}`;
      }
    } catch (autoTranscriptError) {
      console.log('자동 생성 자막 추출 실패:', autoTranscriptError instanceof Error ? autoTranscriptError.message : '알 수 없는 오류');
    }

    // 방법 5: 다른 언어 자막 시도
    try {
      console.log('다른 언어 자막 추출 시도...');
      const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: 'ja'
      });
      
      if (transcripts && transcripts.length > 0) {
        const transcriptText = transcripts
          .map((item: { text: string }) => item.text)
          .join(' ');
        
        console.log('다른 언어 자막 추출 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (다른 언어):\n\n${transcriptText}`;
      }
    } catch (otherLangError) {
      console.log('다른 언어 자막 추출 실패:', otherLangError instanceof Error ? otherLangError.message : '알 수 없는 오류');
    }

    // 방법 6: 자막 없이 시도 (자동 생성 자막 포함)
    try {
      console.log('자막 없이 시도...');
      const transcripts = await YoutubeTranscript.fetchTranscript(videoId, {});
      
      if (transcripts && transcripts.length > 0) {
        const transcriptText = transcripts
          .map((item: { text: string }) => item.text)
          .join(' ');
        
        console.log('자막 없이 추출 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막:\n\n${transcriptText}`;
      }
    } catch (noLangError) {
      console.log('자막 없이 추출 실패:', noLangError instanceof Error ? noLangError.message : '알 수 없는 오류');
    }

    // 방법 7: 직접 YouTube 자막 URL 시도
    try {
      console.log('직접 자막 URL 시도...');
      const transcriptUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko`;
      const response = await fetch(transcriptUrl);
      
      if (response.ok) {
        const xmlText = await response.text();
        console.log('자막 XML 결과:', xmlText.substring(0, 200));
        
        // XML에서 텍스트 추출 (간단한 구현)
        const textMatches = xmlText.match(/<text[^>]*>([^<]+)<\/text>/g);
        if (textMatches && textMatches.length > 0) {
          const transcriptText = textMatches
            .map(match => match.replace(/<text[^>]*>([^<]+)<\/text>/, '$1'))
            .join(' ');
          
          console.log('직접 자막 URL 추출 성공:', transcriptText.length, '문자');
          return `YouTube 영상 자막 (직접 URL):\n\n${transcriptText}`;
        }
      }
    } catch (directUrlError) {
      console.log('직접 자막 URL 실패:', directUrlError instanceof Error ? directUrlError.message : '알 수 없는 오류');
    }

    // 방법 8: 다양한 자막 URL 패턴 시도
    try {
      console.log('다양한 자막 URL 패턴 시도...');
      const transcriptUrls = [
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko&fmt=srv3`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko&fmt=vtt`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko&fmt=ttml`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko&fmt=srv1`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko&fmt=srv2`
      ];

      for (const url of transcriptUrls) {
        try {
          console.log(`URL 시도: ${url}`);
          const response = await fetch(url);
          
          if (response.ok) {
            const xmlText = await response.text();
            console.log('XML 결과 길이:', xmlText.length);
            
            if (xmlText.length > 100) { // 의미있는 결과가 있는지 확인
              // XML에서 텍스트 추출
              const textMatches = xmlText.match(/<text[^>]*>([^<]+)<\/text>/g);
              if (textMatches && textMatches.length > 0) {
                const transcriptText = textMatches
                  .map(match => match.replace(/<text[^>]*>([^<]+)<\/text>/, '$1'))
                  .join(' ');
                
                console.log('다양한 URL 패턴 추출 성공:', transcriptText.length, '문자');
                return `YouTube 영상 자막 (다양한 URL):\n\n${transcriptText}`;
              }
            }
          }
        } catch (urlError) {
          console.log(`URL 실패: ${url}`, urlError instanceof Error ? urlError.message : '알 수 없는 오류');
        }
      }
    } catch (patternError) {
      console.log('다양한 URL 패턴 실패:', patternError instanceof Error ? patternError.message : '알 수 없는 오류');
    }

    // 방법 9: 자막 목록 가져오기 시도
    try {
      console.log('자막 목록 가져오기 시도...');
      const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
      const response = await fetch(listUrl);
      
      if (response.ok) {
        const listXml = await response.text();
        console.log('자막 목록 XML:', listXml.substring(0, 500));
        
        // 사용 가능한 자막 언어 추출
        const langMatches = listXml.match(/lang_code="([^"]+)"/g);
        if (langMatches) {
          console.log('사용 가능한 언어:', langMatches);
          
          // 각 언어로 자막 시도
          for (const langMatch of langMatches) {
            const langCode = langMatch.match(/lang_code="([^"]+)"/)?.[1];
            if (langCode) {
              try {
                const langUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}`;
                const langResponse = await fetch(langUrl);
                
                if (langResponse.ok) {
                  const langXml = await langResponse.text();
                  const textMatches = langXml.match(/<text[^>]*>([^<]+)<\/text>/g);
                  
                  if (textMatches && textMatches.length > 0) {
                    const transcriptText = textMatches
                      .map(match => match.replace(/<text[^>]*>([^<]+)<\/text>/, '$1'))
                      .join(' ');
                    
                    console.log(`언어 ${langCode} 자막 추출 성공:`, transcriptText.length, '문자');
                    return `YouTube 영상 자막 (언어: ${langCode}):\n\n${transcriptText}`;
                  }
                }
              } catch (langError) {
                console.log(`언어 ${langCode} 실패:`, langError instanceof Error ? langError.message : '알 수 없는 오류');
              }
            }
          }
        }
      }
    } catch (listError) {
      console.log('자막 목록 가져오기 실패:', listError instanceof Error ? listError.message : '알 수 없는 오류');
    }

    // 방법 10: User-Agent 헤더 추가 시도
    try {
      console.log('User-Agent 헤더 추가 시도...');
      const response = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=ko`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const xmlText = await response.text();
        console.log('User-Agent XML 결과 길이:', xmlText.length);
        
        if (xmlText.length > 100) {
          const textMatches = xmlText.match(/<text[^>]*>([^<]+)<\/text>/g);
          if (textMatches && textMatches.length > 0) {
            const transcriptText = textMatches
              .map(match => match.replace(/<text[^>]*>([^<]+)<\/text>/, '$1'))
              .join(' ');
            
            console.log('User-Agent 자막 추출 성공:', transcriptText.length, '문자');
            return `YouTube 영상 자막 (User-Agent):\n\n${transcriptText}`;
          }
        }
      }
    } catch (userAgentError) {
      console.log('User-Agent 자막 추출 실패:', userAgentError instanceof Error ? userAgentError.message : '알 수 없는 오류');
    }

    // 방법 11: 다양한 언어 코드 시도
    try {
      console.log('다양한 언어 코드 시도...');
      const languageCodes = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'ru'];
      
      for (const langCode of languageCodes) {
        try {
          console.log(`언어 코드 ${langCode} 시도...`);
          const response = await fetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langCode}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          
          if (response.ok) {
            const xmlText = await response.text();
            console.log(`언어 ${langCode} XML 결과 길이:`, xmlText.length);
            
            if (xmlText.length > 100) {
              const textMatches = xmlText.match(/<text[^>]*>([^<]+)<\/text>/g);
              if (textMatches && textMatches.length > 0) {
                const transcriptText = textMatches
                  .map(match => match.replace(/<text[^>]*>([^<]+)<\/text>/, '$1'))
                  .join(' ');
                
                console.log(`언어 ${langCode} 자막 추출 성공:`, transcriptText.length, '문자');
                return `YouTube 영상 자막 (언어: ${langCode}):\n\n${transcriptText}`;
              }
            }
          }
        } catch (langError) {
          console.log(`언어 ${langCode} 실패:`, langError instanceof Error ? langError.message : '알 수 없는 오류');
        }
      }
    } catch (multiLangError) {
      console.log('다양한 언어 코드 실패:', multiLangError instanceof Error ? multiLangError.message : '알 수 없는 오류');
    }

    // 방법 12: YouTube 페이지에서 자막 정보 추출 시도
    try {
      console.log('YouTube 페이지에서 자막 정보 추출 시도...');
      const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        console.log('YouTube 페이지 HTML 길이:', html.length);
        
        // 자막 관련 정보 찾기
        const transcriptMatches = html.match(/transcriptRenderer[^}]+}/g);
        if (transcriptMatches) {
          console.log('자막 정보 발견:', transcriptMatches.length, '개');
          console.log('자막 정보 샘플:', transcriptMatches[0]?.substring(0, 200));
        }
        
        // 자막 URL 패턴 찾기
        const urlMatches = html.match(/timedtext[^"]+/g);
        if (urlMatches) {
          console.log('자막 URL 패턴 발견:', urlMatches.length, '개');
          console.log('URL 패턴 샘플:', urlMatches[0]);
        }
      }
    } catch (pageError) {
      console.log('YouTube 페이지 추출 실패:', pageError instanceof Error ? pageError.message : '알 수 없는 오류');
    }

    // 방법 13: 대체 자막 서비스 시도
    try {
      console.log('대체 자막 서비스 시도...');
      // 외부 자막 서비스 API 시도 (예시)
      const externalUrls = [
        `https://downsub.com/?url=https://www.youtube.com/watch?v=${videoId}`,
        `https://www.downloadsubtitles.com/?url=https://www.youtube.com/watch?v=${videoId}`
      ];
      
      for (const url of externalUrls) {
        try {
          console.log(`외부 서비스 시도: ${url}`);
          // 실제로는 이 방법들이 작동하지 않을 수 있지만 시도
        } catch (externalError) {
          console.log(`외부 서비스 실패: ${url}`, externalError instanceof Error ? externalError.message : '알 수 없는 오류');
        }
      }
    } catch (externalServiceError) {
      console.log('대체 자막 서비스 실패:', externalServiceError instanceof Error ? externalServiceError.message : '알 수 없는 오류');
    }

    // 방법 14: youtube-transcript-api 라이브러리 시도
    try {
      console.log('youtube-transcript-api 라이브러리 시도...');
      const transcripts = await YoutubeTranscriptApi.fetchTranscript(videoId, {
        lang: 'ko'
      });
      
      if (transcripts && transcripts.length > 0) {
        const transcriptText = transcripts
          .map((item: { text: string }) => item.text)
          .join(' ');
        
        console.log('youtube-transcript-api 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (youtube-transcript-api):\n\n${transcriptText}`;
      }
    } catch (apiError) {
      console.log('youtube-transcript-api 실패:', apiError instanceof Error ? apiError.message : '알 수 없는 오류');
    }

    // 방법 15: youtube-transcript-api 기본 시도
    try {
      console.log('youtube-transcript-api 기본 시도...');
      const transcripts = await YoutubeTranscriptApi.fetchTranscript(videoId);
      
      if (transcripts && transcripts.length > 0) {
        const transcriptText = transcripts
          .map((item: { text: string }) => item.text)
          .join(' ');
        
        console.log('youtube-transcript-api 기본 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (youtube-transcript-api 기본):\n\n${transcriptText}`;
      }
    } catch (apiBasicError) {
      console.log('youtube-transcript-api 기본 실패:', apiBasicError instanceof Error ? apiBasicError.message : '알 수 없는 오류');
    }

    // 방법 16: YouTube 페이지에서 발견한 실제 자막 URL 사용
    try {
      console.log('YouTube 페이지에서 발견한 실제 자막 URL 사용...');
      const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // 자막 URL 패턴 찾기
        const urlMatches = html.match(/timedtext[^"]+/g);
        if (urlMatches && urlMatches.length > 0) {
          console.log('발견된 자막 URL 개수:', urlMatches.length);
          
          for (const urlMatch of urlMatches) {
            try {
              // URL 디코딩
              const decodedUrl = urlMatch.replace(/\\u0026/g, '&');
              const fullUrl = `https://www.youtube.com/api/${decodedUrl}`;
              
              console.log('시도할 자막 URL:', fullUrl);
              
              const transcriptResponse = await fetch(fullUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
              });
              
              if (transcriptResponse.ok) {
                const xmlText = await transcriptResponse.text();
                console.log('실제 자막 URL XML 결과 길이:', xmlText.length);
                
                if (xmlText.length > 100) {
                  const textMatches = xmlText.match(/<text[^>]*>([^<]+)<\/text>/g);
                  if (textMatches && textMatches.length > 0) {
                    const transcriptText = textMatches
                      .map(match => match.replace(/<text[^>]*>([^<]+)<\/text>/, '$1'))
                      .join(' ');
                    
                    console.log('실제 자막 URL 추출 성공:', transcriptText.length, '문자');
                    return `YouTube 영상 자막 (실제 URL):\n\n${transcriptText}`;
                  }
                }
              }
            } catch (urlError) {
              console.log('실제 자막 URL 실패:', urlError instanceof Error ? urlError.message : '알 수 없는 오류');
            }
          }
        }
      }
    } catch (realUrlError) {
      console.log('실제 자막 URL 추출 실패:', realUrlError instanceof Error ? realUrlError.message : '알 수 없는 오류');
    }

    // 방법 17: Puppeteer를 사용한 브라우저 자동화
    try {
      console.log('Puppeteer 브라우저 자동화 시도...');
      
      // 브라우저 시작
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      
      // User-Agent 설정
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // YouTube 페이지로 이동
      await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // 자막 버튼 클릭 시도
      try {
        await page.waitForSelector('button[aria-label*="자막"]', { timeout: 5000 });
        await page.click('button[aria-label*="자막"]');
        console.log('자막 버튼 클릭 성공');
        
        // 자막이 로드될 때까지 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (buttonError) {
        console.log('자막 버튼 클릭 실패:', buttonError instanceof Error ? buttonError.message : '알 수 없는 오류');
      }
      
      // 페이지에서 자막 텍스트 추출 시도
      const transcriptText = await page.evaluate(() => {
        // 자막 컨테이너 찾기
        const transcriptContainer = document.querySelector('.ytp-caption-segment');
        if (transcriptContainer) {
          return transcriptContainer.textContent || '';
        }
        
        // 다른 자막 요소들 찾기
        const captionElements = document.querySelectorAll('[class*="caption"], [class*="subtitle"]');
        if (captionElements.length > 0) {
          return Array.from(captionElements).map(el => el.textContent).join(' ');
        }
        
        // 더 넓은 범위로 자막 요소 검색
        const allElements = document.querySelectorAll('*');
        const transcriptElements = Array.from(allElements).filter(el => {
          const text = el.textContent || '';
          return text.length > 10 && text.length < 1000 && 
                 (text.includes('자막') || text.includes('subtitle') || text.includes('caption'));
        });
        
        if (transcriptElements.length > 0) {
          return transcriptElements.map(el => el.textContent).join(' ');
        }
        
        return '';
      });
      
      await browser.close();
      
      if (transcriptText && transcriptText.length > 10) {
        console.log('Puppeteer 자막 추출 성공:', transcriptText.length, '문자');
        return `YouTube 영상 자막 (Puppeteer):\n\n${transcriptText}`;
      } else {
        console.log('Puppeteer 자막 추출 실패: 자막을 찾을 수 없습니다.');
      }
    } catch (puppeteerError) {
      console.log('Puppeteer 자동화 실패:', puppeteerError instanceof Error ? puppeteerError.message : '알 수 없는 오류');
    }

    // 자막 추출이 모두 실패한 경우 영상 정보 제공
    try {
      console.log('영상 정보 가져오기 시도...');
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      
      if (response.ok) {
        const data = await response.json();
        const title = data.title || '제목 없음';
        const author = data.author_name || '작성자 없음';
        
        console.log('영상 정보 가져오기 성공:', title);
        return `YouTube 영상 정보:\n\n제목: ${title}\n작성자: ${author}\n\n자막을 찾을 수 없어 제목과 작성자 정보만 제공됩니다. 자막이 있는 영상을 선택하시면 더 정확한 요약을 받을 수 있습니다.`;
      }
    } catch (infoError) {
      console.log('영상 정보 가져오기 실패:', infoError instanceof Error ? infoError.message : '알 수 없는 오류');
    }

    // 모든 방법이 실패한 경우
    console.log('모든 자막 추출 방법 실패');
    throw new Error('이 영상의 자막이나 정보를 가져올 수 없습니다. 자막이 있는 공개 영상인지 확인해주세요.');
  } catch (error) {
    console.error('YouTube 내용 추출 오류:', error);
    throw new Error('YouTube 영상 내용을 가져올 수 없습니다. 자막이 있는 공개 영상인지 확인해주세요.');
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

async function extractDocumentContent(file: File): Promise<string> {
  try {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    console.log(`문서 처리 시작: ${fileName} (${fileExtension})`);
    
    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    
    let textContent = '';
    
    // 파일 형식에 따른 처리
    switch (fileExtension) {
      case 'docx':
        // Word 문서 (.docx) 처리
        try {
          // ArrayBuffer를 Buffer로 변환
          const buffer = Buffer.from(arrayBuffer);
          const result = await mammoth.extractRawText({ buffer });
          textContent = result.value;
          console.log('Word 문서 파싱 성공:', textContent.length, '문자');
        } catch (docxError) {
          console.log('Word 문서 파싱 실패:', docxError);
          throw new Error('Word 문서를 읽을 수 없습니다.');
        }
        break;
        
      case 'doc':
        // 구형 Word 문서 (.doc) 처리
        try {
          // ArrayBuffer를 Buffer로 변환
          const buffer = Buffer.from(arrayBuffer);
          const result = await mammoth.extractRawText({ buffer });
          textContent = result.value;
          console.log('구형 Word 문서 파싱 성공:', textContent.length, '문자');
        } catch (docError) {
          console.log('구형 Word 문서 파싱 실패:', docError);
          throw new Error('구형 Word 문서를 읽을 수 없습니다.');
        }
        break;
        
      case 'txt':
        // 텍스트 파일 처리
        try {
          const decoder = new TextDecoder('utf-8');
          textContent = decoder.decode(arrayBuffer);
          console.log('텍스트 파일 파싱 성공:', textContent.length, '문자');
        } catch (txtError) {
          console.log('텍스트 파일 파싱 실패:', txtError);
          throw new Error('텍스트 파일을 읽을 수 없습니다.');
        }
        break;
        
      case 'pdf':
        // PDF 파일 처리 (간단한 텍스트 추출)
        try {
          // PDF 처리는 별도 라이브러리가 필요하므로 일단 텍스트로 시도
          const decoder = new TextDecoder('utf-8');
          textContent = decoder.decode(arrayBuffer);
          console.log('PDF 파일 파싱 시도:', textContent.length, '문자');
        } catch (pdfError) {
          console.log('PDF 파일 파싱 실패:', pdfError);
          throw new Error('PDF 파일을 읽을 수 없습니다. 지원되는 형식: .docx, .doc, .txt');
        }
        break;
        
      default:
        // 기본 텍스트 처리
        try {
          const decoder = new TextDecoder('utf-8');
          textContent = decoder.decode(arrayBuffer);
          console.log('기본 텍스트 파싱 성공:', textContent.length, '문자');
        } catch (defaultError) {
          console.log('기본 텍스트 파싱 실패:', defaultError);
          throw new Error(`지원하지 않는 파일 형식입니다: ${fileExtension}. 지원되는 형식: .docx, .doc, .txt`);
        }
    }
    
    // 내용이 너무 짧거나 바이너리인지 확인
    if (textContent.length < 10) {
      throw new Error('문서에서 텍스트를 추출할 수 없습니다. 지원되는 형식: .docx, .doc, .txt');
    }
    
    // 바이너리 데이터인지 확인 (일반적으로 읽을 수 없는 문자들이 많으면 바이너리)
    const readableChars = textContent.replace(/[^\w\s가-힣]/g, '').length;
    const totalChars = textContent.length;
    const readabilityRatio = readableChars / totalChars;
    
    if (readabilityRatio < 0.3) {
      throw new Error('바이너리 파일입니다. 텍스트 문서를 업로드해주세요. 지원되는 형식: .docx, .doc, .txt');
    }
    
    console.log(`문서 처리 완료: ${textContent.length} 문자, 가독성 비율: ${(readabilityRatio * 100).toFixed(1)}%`);
    return textContent;
    
  } catch (error) {
    console.error('문서 내용 추출 오류:', error);
    throw new Error('문서 내용을 읽을 수 없습니다. 지원되는 형식: .docx, .doc, .txt');
  }
}

async function extractWebsiteContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // HTML에서 텍스트 추출 (간단한 구현)
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return text;
  } catch (error) {
    console.error('웹사이트 내용 추출 오류:', error);
    throw new Error('웹사이트 내용을 가져올 수 없습니다.');
  }
}

async function generateSummary(content: string, type: string): Promise<string> {
  try {
    // 입력 내용이 너무 길면 압축
    let processedContent = content;
    
    // 대략적인 토큰 수 계산 (1 토큰 ≈ 4 문자)
    const estimatedTokens = content.length / 4;
    
    if (estimatedTokens > 12000) { // 안전 마진을 두고 12,000 토큰으로 제한
      console.log(`입력 내용이 너무 깁니다. ${estimatedTokens.toFixed(0)} 토큰 → 12,000 토큰으로 압축`);
      
      // 내용을 여러 부분으로 나누어 처리
      const maxLength = 12000 * 4; // 약 48,000 문자
      processedContent = content.substring(0, maxLength);
      
      // 마지막 문장이 잘리지 않도록 조정
      const lastPeriodIndex = processedContent.lastIndexOf('.');
      if (lastPeriodIndex > maxLength * 0.9) {
        processedContent = processedContent.substring(0, lastPeriodIndex + 1);
      }
      
      console.log(`압축된 내용 길이: ${processedContent.length} 문자`);
    }

    const prompt = type === 'document' ? `문서 내용을 분석하여 다음과 같은 형식으로 요약해주세요:

1. **주요 내용 요약** (2-3문단)
   - 핵심 포인트와 주요 메시지를 명확하게 정리
   - 중요한 정보와 인사이트를 포함

2. **상세 분석** (3-4문단)
   - 내용의 배경과 맥락 설명
   - 주요 인물, 사건, 개념에 대한 상세 설명
   - 내용의 의미와 중요성 분석

3. **핵심 포인트 정리** (2-3문단)
   - 가장 중요한 5-7개의 핵심 포인트
   - 각 포인트에 대한 간단한 설명

4. **전체적인 평가** (1-2문단)
   - 내용의 전체적인 가치와 의미
   - 독자에게 주는 인사이트나 교훈

요약은 최소 400자 이상으로 작성하고, 이해하기 쉽고 체계적으로 구성해주세요.` :
            `주어진 내용을 다음과 같은 형식으로 상세하고 길게 요약해주세요:

1. **주요 내용 요약** (2-3문단)
   - 핵심 포인트와 주요 메시지를 명확하게 정리
   - 중요한 정보와 인사이트를 포함

2. **상세 분석** (3-4문단)
   - 내용의 배경과 맥락 설명
   - 주요 인물, 사건, 개념에 대한 상세 설명
   - 내용의 의미와 중요성 분석

3. **핵심 포인트 정리** (2-3문단)
   - 가장 중요한 5-7개의 핵심 포인트
   - 각 포인트에 대한 간단한 설명

4. **전체적인 평가** (1-2문단)
   - 내용의 전체적인 가치와 의미
   - 독자에게 주는 인사이트나 교훈

요약은 최소 400자 이상으로 작성하고, 이해하기 쉽고 체계적으로 구성해주세요.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: `다음 내용을 위의 형식에 따라 상세하고 길게 요약해주세요:\n\n${processedContent}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '요약을 생성할 수 없습니다.';
  } catch (error) {
    console.error('OpenAI 요약 생성 오류:', error);
    
    // 토큰 제한 오류인 경우 더 짧은 요약 시도
    if (error instanceof Error && error.message.includes('context length')) {
      console.log('토큰 제한 오류 발생. 더 짧은 요약으로 재시도...');
      return await generateShortSummary(content);
    }
    
    throw new Error('요약을 생성할 수 없습니다.');
  }
}

// 더 짧은 요약을 생성하는 함수
async function generateShortSummary(content: string): Promise<string> {
  try {
    // 내용을 더 많이 압축
    const maxLength = 8000 * 4; // 약 32,000 문자
    let processedContent = content.substring(0, maxLength);
    
    const lastPeriodIndex = processedContent.lastIndexOf('.');
    if (lastPeriodIndex > maxLength * 0.9) {
      processedContent = processedContent.substring(0, lastPeriodIndex + 1);
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "주어진 내용을 간결하고 핵심적인 요약으로 정리해주세요. 주요 포인트와 인사이트를 포함하여 300자 이상으로 작성해주세요."
        },
        {
          role: "user",
          content: `다음 내용을 요약해주세요:\n\n${processedContent}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '요약을 생성할 수 없습니다.';
  } catch (error) {
    console.error('짧은 요약 생성 오류:', error);
    return '입력 내용이 너무 길어서 요약을 생성할 수 없습니다. 더 짧은 내용으로 다시 시도해주세요.';
  }
} 