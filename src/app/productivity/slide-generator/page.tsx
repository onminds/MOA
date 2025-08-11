'use client';

import { useState } from 'react';
import { Wand2, Download, Copy, RefreshCw, Eye, Code, FileText, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

export default function SlideGeneratorPage() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [slideCount, setSlideCount] = useState(5);
  const [htmlContents, setHtmlContents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [currentSection, setCurrentSection] = useState(1);
  const [totalSections, setTotalSections] = useState(0);
  const [script, setScript] = useState<string>('');
  const [showScript, setShowScript] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('template1');
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

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
      
      // 모든 섹션을 순차적으로 생성
      for (let section = 1; section <= slideCount; section++) {
        console.log(`🎯 ${section}번째 섹션 생성 중...`);
        console.log(`🎨 선택된 템플릿: ${selectedTemplate}`);
        
        const response = await fetch('/api/slide-generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            topic, 
            slideCount, 
            format: 'html',
            section,
            template: selectedTemplate
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || `${section}번째 섹션 생성에 실패했습니다.`);
        }

        console.log(`✅ ${section}번째 섹션 완료 - 사용된 템플릿: ${data.usedTemplate}`);
        allContents.push(data.html);
        setHtmlContents([...allContents]);
        setTotalSections(slideCount);
        setScript(data.script);
        
        // 마지막 섹션이 아니면 잠시 대기
        if (section < slideCount) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        }
      }
      
      setCurrentSection(slideCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setIsGeneratingAll(false);
    }
  };

  const downloadPPT = async () => {
    if (!htmlContents.length) {
      alert('HTML 내용이 없습니다.');
      return;
    }

    // 모든 HTML 내용을 하나로 합치기
    const combinedHtml = htmlContents.join('\n\n');
    
    // HTML 형식인 경우 직접 다운로드
    const blob = new Blob([combinedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic || 'presentation'}_all_sections.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (!htmlContents.length) {
      alert('HTML 내용이 없습니다.');
      return;
    }

    const combinedHtml = htmlContents.join('\n\n');
    navigator.clipboard.writeText(combinedHtml);
    alert('HTML 코드가 클립보드에 복사되었습니다.');
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-8">
        <div className="max-w-6xl mx-auto">
          {/* 뒤로가기 버튼 */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/productivity')}
              className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              생산성 도구로 돌아가기
            </button>
          </div>

          {/* 헤더 */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">AI 슬라이드 생성</h1>
            <p className="text-gray-600 text-lg mt-2">
              주제를 입력하면 AI가 자동으로 슬라이드를 생성해드립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 입력 영역 */}
            <div className="space-y-6">
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                  슬라이드 설정
                </h2>
                
                <div className="space-y-6">
                  {/* 주제 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      슬라이드 주제
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="예: 인공지능의 미래"
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      disabled={isLoading}
                    />
                  </div>

                  {/* 슬라이드 개수 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      슬라이드 개수
                    </label>
                    <select
                      value={slideCount}
                      onChange={(e) => setSlideCount(Number(e.target.value))}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      disabled={isLoading}
                    >
                      <option value={3}>3개</option>
                      <option value={5}>5개</option>
                      <option value={7}>7개</option>
                      <option value={10}>10개</option>
                    </select>
                  </div>

                  {/* 템플릿 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      템플릿 선택
                    </label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      disabled={isLoading}
                    >
                      <option value="template1">템플릿 1 - 기본 소개형</option>
                      <option value="template2">템플릿 2 - 모던 디자인</option>
                      <option value="template3">템플릿 3 - 통계/트렌드형</option>
                      <option value="template4">템플릿 4 - 학습/방법론형</option>
                      <option value="template5">템플릿 5 - 비즈니스형</option>
                      <option value="template6">템플릿 6 - 문제점 분석형</option>
                      <option value="template7">템플릿 7 - 성공 사례형</option>
                      <option value="template8">템플릿 8 - 실패 사례형</option>
                      <option value="template9">템플릿 9 - 소비자 인사이트형</option>
                      <option value="template10">템플릿 10 - 정책/제도형</option>
                      <option value="template11">템플릿 11 - 해결책 제시형</option>
                      <option value="template12">템플릿 12 - 결론/마무리형</option>
                    </select>
                  </div>

                  <button
                    onClick={generateSlides}
                    disabled={!topic.trim() || isLoading}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        슬라이드 생성 중...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-5 h-5" />
                        슬라이드 생성
                      </>
                    )}
                  </button>

                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-red-800 font-medium">오류 발생</div>
                      <div className="text-red-600 text-sm mt-1">{error}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 결과 영역 */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"></div>
                생성된 슬라이드
              </h2>
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                {htmlContents.length > 0 ? (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <div className="text-sm text-gray-600">
                        총 {htmlContents.length}개 섹션 생성 완료
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={downloadPPT}
                          disabled={isDownloading}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          다운로드
                        </button>
                        <button
                          onClick={copyToClipboard}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          복사
                        </button>
                        <button
                          onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          {showHtmlPreview ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {showHtmlPreview ? '코드 보기' : '미리보기'}
                        </button>
                      </div>
                    </div>
                    
                    {showHtmlPreview ? (
                      <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{htmlContents.join('\n\n')}</pre>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {htmlContents.map((content, index) => (
                          <div key={index} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                            <div className="bg-gray-100 px-4 py-3 text-sm font-medium text-gray-700 border-b flex items-center justify-between">
                              <span>{index + 1}번째 섹션</span>
                              <span className="text-xs text-gray-500">슬라이드 미리보기</span>
                            </div>
                            <div className="relative overflow-hidden" style={{ height: '400px', minHeight: '400px', aspectRatio: '16/9' }}>
                              <iframe
                                srcDoc={`
                                   <!DOCTYPE html>
                                   <html>
                                   <head>
                                     <style>
                                       * {
                                         margin: 0;
                                         padding: 0;
                                         box-sizing: border-box;
                                       }
                                       body {
                                         width: 100%;
                                         height: 100%;
                                         font-family: 'Noto Serif KR', serif !important;
                                       }
                                       body::-webkit-scrollbar {
                                         width: 8px;
                                       }
                                       body::-webkit-scrollbar-track {
                                         background: #f1f1f1;
                                       }
                                       body::-webkit-scrollbar-thumb {
                                         background: #888;
                                         border-radius: 4px;
                                       }
                                       body::-webkit-scrollbar-thumb:hover {
                                         background: #555;
                                       }
                                       html {
                                         width: 100%;
                                         height: 100%;
                                       }
                                       .slide-container {
                                         width: 100%;
                                         height: 100%;
                                         display: flex;
                                         align-items: center;
                                         justify-content: center;
                                       }
                                       .slide-content {
                                         width: 100%;
                                         height: 100%;
                                         display: flex;
                                         align-items: center;
                                         justify-content: center;
                                       }
                                       .slide-content > * {
                                         max-width: 100%;
                                         max-height: 100%;
                                         width: 100%;
                                         height: 100%;
                                         object-fit: contain;
                                         object-position: center;
                                       }
                                       img {
                                         max-width: 100%;
                                         max-height: 100%;
                                         width: auto;
                                         height: auto;
                                         object-fit: contain;
                                       }
                                       div {
                                         max-width: 100%;
                                         max-height: 100%;
                                       }
                                       /* 강제 가로 텍스트 적용 */
                                       h1, h2, h3, p, span, div, li, ul, ol {
                                         writing-mode: horizontal-tb !important;
                                         text-orientation: mixed !important;
                                         white-space: normal !important;
                                         word-wrap: break-word !important;
                                         word-break: keep-all !important;
                                         overflow-wrap: break-word !important;
                                         line-height: normal !important;
                                         text-align: left !important;
                                       }
                                       /* 제목 강제 가로 */
                                       .title, h1 {
                                         writing-mode: horizontal-tb !important;
                                         text-orientation: mixed !important;
                                         white-space: normal !important;
                                         word-wrap: break-word !important;
                                         word-break: keep-all !important;
                                         font-size: 48px !important;
                                         font-weight: bold !important;
                                         color: white !important;
                                         text-shadow: 2px 2px 4px rgba(0,0,0,0.3) !important;
                                         margin-bottom: 20px !important;
                                         line-height: 1.2 !important;
                                       }
                                       /* 설명 강제 가로 */
                                       .description, p {
                                         writing-mode: horizontal-tb !important;
                                         text-orientation: mixed !important;
                                         white-space: normal !important;
                                         word-wrap: break-word !important;
                                         word-break: keep-all !important;
                                         font-size: 20px !important;
                                         color: rgba(255,255,255,0.9) !important;
                                         line-height: 1.6 !important;
                                         text-shadow: 1px 1px 2px rgba(0,0,0,0.3) !important;
                                       }
                                       /* 모든 텍스트 요소 강제 가로 */
                                       * {
                                         writing-mode: horizontal-tb !important;
                                         text-orientation: mixed !important;
                                       }
                                     </style>
                                   </head>
                                   <body>
                                     <div class="slide-container">
                                       <div class="slide-content">
                                         ${content.replace(/<body[^>]*>|<\/body>/gi, '')}
                                       </div>
                                     </div>
                                   </body>
                                   </html>
                                 `}
                                 className="w-full h-full"
                                 title={`Section ${index + 1} Preview`}
                                 style={{ 
                                   border: 'none', 
                                   width: '100%', 
                                   height: '100%',
                                   maxWidth: '100%',
                                   maxHeight: '100%',
                                   overflow: 'hidden'
                                 }}
                               />
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-80 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <Wand2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">왼쪽에서 주제를 입력하고 슬라이드를 생성해보세요</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 