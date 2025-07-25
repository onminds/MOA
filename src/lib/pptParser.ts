// @ts-ignore
import AdmZip from 'adm-zip';
// @ts-ignore
import { parseString } from 'xml2js';

interface SlideText {
  slideNumber: number;
  text: string;
}

// PPT 파일에서 텍스트 추출
export async function extractTextFromPPT(buffer: Buffer): Promise<string> {
  try {
    console.log('📊 PPT 파일 텍스트 추출 시작...');
    console.log('📊 PPT 파일 크기:', buffer.length, 'bytes');
    
    // PPT 파일을 ZIP으로 압축 해제 (PPTX는 ZIP 형식)
    const zip = new AdmZip(buffer);
    
    console.log('📊 PPT 파일 압축 해제 완료');
    
    let fullText = '';
    const slideTexts: SlideText[] = [];
    
    // 슬라이드 파일들 찾기
    const slideEntries = zip.getEntries().filter((entry: any) => 
      entry.entryName.startsWith('ppt/slides/slide')
    );
    
    console.log('📊 발견된 슬라이드 파일 수:', slideEntries.length);
    
    // 각 슬라이드에서 텍스트 추출
    for (let i = 0; i < slideEntries.length; i++) {
      try {
        const slideEntry = slideEntries[i];
        const slideNumber = i + 1;
        console.log(`📄 슬라이드 ${slideNumber} 텍스트 추출 중...`);
        
        // 슬라이드 XML 파싱
        const slideXml = slideEntry.getData().toString('utf8');
        
        // XML을 JSON으로 변환
        const slideData: any = await new Promise((resolve, reject) => {
          parseString(slideXml, (err: any, result: any) => {
            if (err) reject(err);
            else resolve(result);
          });
        });
        
        let slideText = '';
        
        // 디버깅: XML 구조 확인
        console.log(`🔍 슬라이드 ${slideNumber} XML 구조:`, JSON.stringify(slideData, null, 2).substring(0, 500));
        
        // 다양한 경로로 텍스트 추출 시도
        if (slideData) {
          // 방법 1: p:sld > p:cSld > p:spTree > p:sp > p:txBody > a:p > a:r > a:t
          if (slideData['p:sld'] && slideData['p:sld'][0]) {
            const slide = slideData['p:sld'][0];
            if (slide['p:cSld'] && slide['p:cSld'][0] && slide['p:cSld'][0]['p:spTree']) {
              const spTree = slide['p:cSld'][0]['p:spTree'];
              
              // 모든 도형에서 텍스트 추출
              if (spTree['p:sp']) {
                for (const sp of spTree['p:sp']) {
                  if (sp['p:txBody'] && sp['p:txBody'][0] && sp['p:txBody'][0]['a:p']) {
                    for (const p of sp['p:txBody'][0]['a:p']) {
                      if (p['a:r'] && p['a:r'][0] && p['a:r'][0]['a:t']) {
                        for (const r of p['a:r']) {
                          if (r['a:t'] && r['a:t'][0]) {
                            slideText += r['a:t'][0] + '\n';
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          
          // 방법 2: 다른 가능한 경로들
          if (!slideText.trim()) {
            // 전체 XML에서 a:t 태그 찾기
            const textMatches = slideXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
            if (textMatches) {
              for (const match of textMatches) {
                const textContent = match.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, '');
                if (textContent.trim()) {
                  slideText += textContent.trim() + '\n';
                }
              }
            }
          }
          
          // 방법 3: 모든 텍스트 태그 찾기
          if (!slideText.trim()) {
            const allTextMatches = slideXml.match(/<[^>]*>([^<]*)<\/[^>]*>/g);
            if (allTextMatches) {
              for (const match of allTextMatches) {
                const textContent = match.replace(/<[^>]*>/, '').replace(/<\/[^>]*>/, '');
                if (textContent.trim() && textContent.length > 1) {
                  slideText += textContent.trim() + '\n';
                }
              }
            }
          }
        }
        
        if (slideText.trim()) {
          slideTexts.push({
            slideNumber: slideNumber,
            text: slideText.trim()
          });
          fullText += `=== 슬라이드 ${slideNumber} ===\n${slideText}\n\n`;
          console.log(`✅ 슬라이드 ${slideNumber} 텍스트 추출 완료, 길이:`, slideText.length);
          console.log(`📝 슬라이드 ${slideNumber} 텍스트 미리보기:`, slideText.substring(0, 100));
        } else {
          console.log(`⚠️ 슬라이드 ${slideNumber}에서 텍스트를 찾을 수 없음`);
        }
        
      } catch (slideError) {
        console.error(`❌ 슬라이드 ${i + 1} 처리 실패:`, slideError);
      }
    }
    
    console.log('📊 총 추출된 슬라이드 수:', slideTexts.length);
    console.log('📊 전체 텍스트 길이:', fullText.length);
    console.log('📊 텍스트 미리보기:', fullText.substring(0, 300) + '...');
    
    if (!fullText.trim()) {
      throw new Error('PPT에서 텍스트를 추출할 수 없습니다.');
    }
    
    console.log('✅ PPT 텍스트 추출 성공!');
    return fullText.trim();
    
  } catch (error) {
    console.error('❌ PPT 텍스트 추출 실패:', error);
    throw error;
  }
}

// PPT 파일 유효성 검사
export function isValidPPTFile(fileName: string): boolean {
  const validExtensions = ['.ppt', '.pptx'];
  const extension = fileName.toLowerCase();
  return validExtensions.some(ext => extension.endsWith(ext));
} 