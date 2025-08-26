'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Download, RefreshCw, Eye, FileText, File, Edit3 } from 'lucide-react';
import Header from '../components/Header';
import SlideEditor from '../../components/SlideEditor';

export default function PPTCreatePage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [htmlContents, setHtmlContents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentSection, setCurrentSection] = useState(1);
  const [script, setScript] = useState<string>('');
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [templateSet, setTemplateSet] = useState<'Modern company' | 'Clinique Slide'>('Modern company');
  
  // 편집 관련 상태
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [editedHtmlContents, setEditedHtmlContents] = useState<string[]>([]);

  // 편집된 HTML 내용 초기화
  useEffect(() => {
    if (htmlContents.length > 0) {
      // 기존 편집된 내용이 없거나 길이가 다르면 새로 초기화
      if (editedHtmlContents.length !== htmlContents.length) {
        setEditedHtmlContents([...htmlContents]);
      }
    }
  }, [htmlContents, editedHtmlContents.length]);

  // 슬라이드 편집 시작
  const startEditingSlide = (index: number) => {
    setEditingSlideIndex(index);
  };

  // 슬라이드 편집 완료
  const finishEditingSlide = () => {
    setEditingSlideIndex(null);
  };

  // 슬라이드 내용 업데이트
  const updateSlideContent = (newHtml: string) => {
    if (editingSlideIndex !== null) {
      console.log('=== 슬라이드 내용 업데이트 시작 ===');
      console.log('슬라이드 인덱스:', editingSlideIndex);
      console.log('원본 길이:', editedHtmlContents[editingSlideIndex]?.length || 0);
      console.log('새 HTML 길이:', newHtml.length);
      console.log('새 HTML 미리보기:', newHtml.substring(0, 150) + '...');
      
      const newContents = [...editedHtmlContents];
      const oldContent = newContents[editingSlideIndex];
      newContents[editingSlideIndex] = newHtml;
      setEditedHtmlContents(newContents);
      
      console.log('내용이 실제로 변경됨:', oldContent !== newHtml);
      console.log('업데이트된 배열 길이:', newContents.length);
      console.log('=== 슬라이드 내용 업데이트 완료 ===');
      
      // 강제로 리렌더링 트리거
      setTimeout(() => {
        console.log('리렌더링 후 editedHtmlContents 확인:', editedHtmlContents.length);
      }, 100);
    } else {
      console.error('editingSlideIndex가 null입니다!');
    }
  };

  // 단계 진입 검증: 템플릿 선택 완료 여부 확인 후 값 주입 (주제는 이 페이지에서 입력)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTpl = window.localStorage.getItem('ppt_template_set') as 'Modern company' | 'Clinique Slide' | null;
    if (!savedTpl) {
      router.replace('/ppt-template');
      return;
    }
    setTemplateSet(savedTpl);
  }, [router]);

  // 고정된 12페이지 구조
  const fixedSlideCount = 12;
  const slideTypes = [
    { type: 'title', name: '1. 제목 슬라이드' },
    { type: 'table-of-contents', name: '2. 목차' },
    { type: 'statistics', name: '3. 통계 & 트렌드' },
    { type: 'priority', name: '4. 우선순위 분석' },
    { type: 'metrics', name: '5. 성과 지표' },
    { type: 'jobs', name: '6. 일자리 변화와 기회' },
    { type: 'policy', name: '7. 한국의 AI 전략과 정책' },
    { type: 'ethics', name: '8. 윤리와 도전과제' },
    { type: 'cases', name: '9. 기술·비즈니스 사례' },
    { type: 'future', name: '10. 미래 준비사항' },
    { type: 'summary', name: '11. 요약 및 행동계획' },
    { type: 'thanks', name: '12. 감사합니다 & 참고자료' }
  ];

  const generateSlides = async () => {
    if (!topic.trim()) {
      setError('주제를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setIsGeneratingAll(true);
    setError('');
    setHtmlContents([]);

    try {
      const allContents: string[] = [];
      
      // 고정된 5개 섹션을 순차적으로 생성
      for (let section = 1; section <= fixedSlideCount; section++) {
        console.log(`🎯 ${section}번째 섹션 생성 중... (${slideTypes[section-1].name})`);
        setCurrentSection(section);
        
        const apiPath = templateSet === 'Clinique Slide' ? '/api/slide-generate2' : '/api/slide-generate';
        const response = await fetch(apiPath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            topic, 
            slideCount: fixedSlideCount, 
            format: 'html',
            section
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `${section}번째 섹션 생성에 실패했습니다.`);
        }

        allContents.push(data.html);
        setHtmlContents([...allContents]);
        setScript(data.script);
        
        // 마지막 섹션이 아니면 잠시 대기
        if (section < fixedSlideCount) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        }
      }
      
      setCurrentSection(fixedSlideCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setIsGeneratingAll(false);
    }
  };

  const downloadAsPDF = async () => {
    if (htmlContents.length === 0) {
      alert('먼저 슬라이드를 생성해주세요.');
      return;
    }

    setIsDownloading(true);
    try {
      // 동적으로 jsPDF와 html2canvas 임포트
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      console.log(`📄 통합 PDF 생성 시작 (${htmlContents.length}개 섹션)`);
      
      // PDF 객체 생성 (A4 landscape)
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < htmlContents.length; i++) {
        console.log(`📄 섹션 ${i + 1}/${htmlContents.length} 처리 중...`);
        
        // 임시 div 생성하여 HTML 렌더링
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '1280px';
        tempDiv.style.height = '720px';
        tempDiv.style.backgroundColor = 'white';
        tempDiv.innerHTML = `
          <div style="width: 1280px; height: 720px; background: white; position: relative;">
            ${cleanHtmlForPreview(htmlContents[i])}
          </div>
        `;
        
        document.body.appendChild(tempDiv);

        try {
          // HTML을 캔버스로 변환
          const canvas = await html2canvas(tempDiv, {
            width: 1280,
            height: 720,
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: false
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          
          // 첫 번째 페이지가 아니면 새 페이지 추가
          if (i > 0) {
            pdf.addPage();
          }
          
          // 이미지를 PDF에 추가
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

          console.log(`✅ 섹션 ${i + 1} 추가 완료`);
        } catch (sectionError) {
          console.error(`섹션 ${i + 1} 처리 오류:`, sectionError);
        } finally {
          // 임시 div 제거
          document.body.removeChild(tempDiv);
        }

        // 다음 섹션 처리 전 잠시 대기
        if (i < htmlContents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 통합 PDF 다운로드
      const fileName = `${topic}_전체슬라이드_${Date.now()}.pdf`;
      pdf.save(fileName);
      
      console.log(`✅ 통합 PDF 생성 완료: ${fileName}`);
      alert(`통합 PDF 파일이 다운로드되었습니다!\n파일명: ${fileName}`);
    } catch (err) {
      console.error('PDF 다운로드 오류:', err);
      alert(err instanceof Error ? err.message : 'PDF 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };



  const downloadAsPPTX = async () => {
    if (htmlContents.length === 0) {
      alert('먼저 슬라이드를 생성해주세요.');
      return;
    }

    setIsDownloading(true);
    try {
      // 동적으로 html2canvas 임포트
      const html2canvas = (await import('html2canvas')).default;
      // pptxgenjs는 CDN 스크립트로 로드하여 번들에 node:* 의존성이 포함되지 않도록 처리
      const ensurePptx = () => new Promise<any>((resolve, reject) => {
        if (typeof window !== 'undefined' && (window as any).PptxGenJS) {
          resolve((window as any).PptxGenJS);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.min.js';
        script.async = true;
        script.onload = () => {
          if ((window as any).PptxGenJS) resolve((window as any).PptxGenJS);
          else reject(new Error('pptxgenjs 로드 실패'));
        };
        script.onerror = () => reject(new Error('pptxgenjs 스크립트 로드 오류'));
        document.body.appendChild(script);
      });
      const PptxGenJS = await ensurePptx();

      console.log(`📊 통합 PPTX 생성 시작 (${htmlContents.length}개 슬라이드)`);
      
      // PowerPoint 생성
      const pptx = new PptxGenJS();
      
      // 슬라이드 크기 설정 (16:9)
      pptx.defineLayout({ 
        name: 'LAYOUT_16x9', 
        width: 10, 
        height: 5.625 
      });
      pptx.layout = 'LAYOUT_16x9';

      for (let i = 0; i < htmlContents.length; i++) {
        console.log(`📊 슬라이드 ${i + 1}/${htmlContents.length} 생성 중...`);
        
        // 슬라이드 추가
        const slide = pptx.addSlide();
        slide.background = { fill: 'FFFFFF' };
        
        // 임시 div 생성하여 HTML 렌더링
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        tempDiv.style.width = '1280px';
        tempDiv.style.height = '720px';
        tempDiv.style.backgroundColor = 'white';
        tempDiv.innerHTML = `
          <div style="width: 1280px; height: 720px; background: white; position: relative;">
            ${cleanHtmlForPreview(htmlContents[i])}
          </div>
        `;
        
        document.body.appendChild(tempDiv);

        try {
          // HTML을 캔버스로 변환
          const canvas = await html2canvas(tempDiv, {
            width: 1280,
            height: 720,
            scale: 1,
            backgroundColor: '#ffffff',
            useCORS: true,
            allowTaint: true,
            logging: false
          });

          // 캔버스를 base64 이미지로 변환
          const imgData = canvas.toDataURL('image/png');
          
          // 이미지를 슬라이드에 추가 (전체 크기)
          slide.addImage({
            data: imgData,
            x: 0,
            y: 0,
            w: 10,
            h: 5.625
          });

          console.log(`✅ 슬라이드 ${i + 1} 추가 완료`);
        } catch (sectionError) {
          console.error(`슬라이드 ${i + 1} 처리 오류:`, sectionError);
          
          // 오류 시 텍스트만 추가
          slide.addText(`슬라이드 ${i + 1}\n\n생성 중 오류가 발생했습니다.\n원본 HTML을 확인해주세요.`, {
            x: 1,
            y: 2,
            w: 8,
            h: 2,
            fontSize: 24,
            fontFace: 'Arial',
            color: 'FF0000',
            align: 'center',
            valign: 'middle'
          });
        } finally {
          // 임시 div 제거
          document.body.removeChild(tempDiv);
        }

        // 다음 슬라이드 처리 전 잠시 대기
        if (i < htmlContents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // PPTX 파일 다운로드
      const fileName = `${topic}_전체슬라이드_${Date.now()}.pptx`;
      await pptx.writeFile({ fileName });
      
      console.log(`✅ 통합 PPTX 생성 완료: ${fileName}`);
      alert(`통합 PPTX 파일이 다운로드되었습니다!\n파일명: ${fileName}\n\n✅ 미리보기와 100% 동일\n📊 ${htmlContents.length}개 슬라이드 포함`);
    } catch (err) {
      console.error('PPTX 다운로드 오류:', err);
      alert(err instanceof Error ? err.message : 'PPTX 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBack = () => {
    router.push('/ppt-template');
  };

  // HTML에서 프롬프트 제거 함수 (강화)
  const cleanHtmlForPreview = (htmlContent: string) => {
    let cleanedHtml = htmlContent
      // self-closing meta 프롬프트 제거 (<meta ... />)
      .replace(/<meta\s+name=["']template-prompt["'][\s\S]*?\/>/gi, '')
      // 닫는 태그 형태 제거 (<meta ...></meta>)
      .replace(/<meta\s+name=["']template-prompt["'][\s\S]*?<\/meta>/gi, '')
      // HTML 주석/CSS 주석/한 줄 주석 제거
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\n)\s*\/\/.*$/gm, '');

    return cleanedHtml;
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="container mx-auto px-2 py-12 max-w-full">
        {/* 왼쪽 위 뒤로 버튼 */}
        <button 
          onClick={handleBack} 
          className="fixed top-20 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all text-gray-700 hover:text-gray-900 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          뒤로
        </button>
        
        <div className="mb-2">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">AI PPT 생성기</h1>
            <p className="text-gray-600">주제를 입력하면 AI가 자동으로 프레젠테이션을 만들어드립니다</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2">
          {/* 왼쪽 여백 */}
          <div className="col-span-1"></div>
          {/* 왼쪽: 입력 폼 */}
          <div className="bg-white rounded-2xl shadow-xl p-8 col-span-3">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">프레젠테이션 설정</h2>
              
              <div className="space-y-6">
                <div>
                  <div className="bg-gray-100 rounded-lg px-4 py-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700 text-center">선택된 템플릿</label>
                  </div>
                  {/* 템플릿 미리보기 이미지 */}
                  <div className="mb-3 rounded-lg overflow-hidden border aspect-video max-w-xs mx-auto">
                    <img 
                      src={`/images/templates/${templateSet === 'Modern company' ? 'modern-company' : 'clinique-slide'}/1.${templateSet === 'Modern company' ? 'jpg' : 'png'}`}
                      alt={`${templateSet} template preview`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // 이미지 로드 실패시 다른 확장자 시도
                        const target = e.target as HTMLImageElement;
                        const currentSrc = target.src;
                        
                        if (currentSrc.includes('.jpg')) {
                          target.src = currentSrc.replace('.jpg', '.png');
                        } else if (currentSrc.includes('.png')) {
                          target.src = currentSrc.replace('.png', '.jpeg');
                        } else if (currentSrc.includes('.jpeg')) {
                          target.src = currentSrc.replace('.jpeg', '.webp');
                        } else {
                          // 모든 확장자 실패시 기본 그라디언트로 대체
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.style.background = templateSet === 'Modern company' 
                              ? 'linear-gradient(135deg, #1e3a8a, #4338ca)' 
                              : 'linear-gradient(135deg, #059669, #14b8a6)';
                            parent.style.display = 'flex';
                            parent.style.alignItems = 'center';
                            parent.style.justifyContent = 'center';
                            parent.innerHTML = `<span class="text-white font-medium">${templateSet}</span>`;
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="px-3 py-2 rounded-lg border bg-gray-50 text-sm text-gray-800">{templateSet}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">주제 *</label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예: AI의 미래, 기업 디지털 전환, 환경 보호 등"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>



                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={generateSlides}
                  disabled={isLoading || !topic.trim()}
                  className="w-full bg-black text-white py-4 px-6 rounded-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center"
                >
                  {isLoading ? (
                    <span>
                      {currentSection}번째 슬라이드 생성 중... 
                      ({slideTypes[currentSection - 1]?.name})
                    </span>
                  ) : (
                    <span>12페이지 PPT 생성하기</span>
                  )}
                </button>

                {/* 생성 진행률 표시 */}
                {isLoading && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>진행률: {currentSection}/{fixedSlideCount}</span>
                      <span>{Math.round((currentSection / fixedSlideCount) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-black h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(currentSection / fixedSlideCount) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(htmlContents.length > 0) && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">액션</h3>
                <div className="space-y-3">
                  <button
                    onClick={downloadAsPDF}
                    disabled={isDownloading || !htmlContents.length}
                    className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>PDF 생성 중...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        <span>PDF 다운로드</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={downloadAsPPTX}
                    disabled={isDownloading || !htmlContents.length}
                    className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>PPTX 생성 중...</span>
                      </>
                    ) : (
                      <>
                        <File className="w-4 h-4" />
                        <span>PPTX 다운로드</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}


          </div>

          {/* 오른쪽: HTML 미리보기 */}
          <div className="bg-white rounded-2xl shadow-xl pl-4 pr-2 py-8 col-span-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">HTML 미리보기</h2>
              
              {htmlContents.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-4">
                    총 {htmlContents.length}개 섹션 생성 완료
                  </div>
                  
                  <div className="space-y-4 max-h-[800px] overflow-y-auto">
                    {htmlContents.map((content, index) => (
                      <div key={index} className="border rounded-lg overflow-hidden inline-block relative" style={{ height: '650px', minHeight: '600px', width: '1024px' }}>
                        <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 border-b flex items-center justify-between">
                          <span>{index + 1}번째 섹션</span>
                          <button
                            onClick={() => startEditingSlide(index)}
                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                          >
                            <Edit3 size={14} />
                            세부 수정
                          </button>
                        </div>
                        <div style={{ width: '1280px', height: '720px', transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                          <iframe
                            srcDoc={cleanHtmlForPreview(editedHtmlContents[index] || content)}
                            className="w-full h-full"
                            title={`Section ${index + 1} Preview`}
                            style={{ border: 'none', width: '1280px', height: '720px' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden inline-block" style={{ height: '650px', minHeight: '600px', width: '1024px' }}>
                  <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 border-b">
                    미리보기
                  </div>
                  <div style={{ width: '1280px', height: '720px', transform: 'scale(0.8)', transformOrigin: 'top left' }}>
                    <div className="w-full h-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center" style={{ width: '1280px', height: '720px' }}>
                      <div className="text-center">
                        <Wand2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">왼쪽에서 주제를 입력하고 PPT를 생성해보세요</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* 슬라이드 편집 모달 */}
      <SlideEditor
        isOpen={editingSlideIndex !== null}
        onClose={finishEditingSlide}
        htmlContent={editingSlideIndex !== null ? (editedHtmlContents[editingSlideIndex] || htmlContents[editingSlideIndex] || '') : ''}
        onSave={updateSlideContent}
        slideIndex={editingSlideIndex || 0}
      />
    </div>
  );
} 