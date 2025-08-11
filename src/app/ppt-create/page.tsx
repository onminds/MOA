'use client';

import { useState } from 'react';
import { Wand2, Download, Copy, RefreshCw, Eye, Code, FileText } from 'lucide-react';

export default function PPTCreatePage() {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-0 py-2">
        <div className="mb-2">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">AI PPT 생성기</h1>
          <p className="text-gray-600">주제를 입력하면 AI가 자동으로 프레젠테이션을 만들어드립니다</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-2">
          {/* 왼쪽: 입력 폼 */}
          <div className="bg-white rounded-2xl shadow-xl p-8 lg:col-span-2">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">프레젠테이션 설정</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    주제 *
                  </label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="예: AI의 미래, 기업 디지털 전환, 환경 보호 등"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    총 카드 섹션 수
                  </label>
                  <select
                    value={slideCount}
                    onChange={(e) => setSlideCount(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={3}>3개</option>
                    <option value={5}>5개</option>
                    <option value={7}>7개</option>
                    <option value={10}>10개</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    템플릿 선택
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        value="template1"
                        checked={selectedTemplate === 'template1'}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">템플릿 1 - 목차 테마</div>
                        <div className="text-sm text-gray-500">목차 형식의 슬라이드 디자인</div>
                      </div>
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={generateSlides}
                  disabled={isLoading || !topic.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>{isGeneratingAll ? '전체 섹션 생성 중...' : '생성 중...'}</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      <span>전체 섹션 생성하기</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {(htmlContents.length > 0) && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">액션</h3>
                <div className="space-y-3">
                  <button
                    onClick={downloadPPT}
                    disabled={isDownloading || !htmlContents.length}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>HTML 생성 중...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>HTML 다운로드</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>클립보드에 복사</span>
                  </button>
                  {script && (
                    <button
                      onClick={() => setShowScript(!showScript)}
                      className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>전체 대본 보기</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 전체 대본 표시 */}
            {showScript && script && (
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">전체 PPT 대본</h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">{script}</pre>
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: HTML 미리보기 */}
          <div className="bg-white rounded-2xl shadow-xl p-8 lg:col-span-4">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">HTML 미리보기</h2>
              
              {htmlContents.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      총 {htmlContents.length}개 섹션 생성 완료
                    </div>
                    <button
                      onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                      {showHtmlPreview ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      <span>{showHtmlPreview ? '코드 보기' : '미리보기'}</span>
                    </button>
                  </div>
                  
                  {showHtmlPreview ? (
                    <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{htmlContents.join('\n\n')}</pre>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[800px] overflow-y-auto">
                      {htmlContents.map((content, index) => (
                        <div key={index} className="border rounded-lg overflow-hidden" style={{ height: '700px', minHeight: '450px' }}>
                          <div className="bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 border-b">
                            {index + 1}번째 섹션
                          </div>
                          <iframe
                            srcDoc={content}
                            className="w-full h-full"
                            title={`Section ${index + 1} Preview`}
                            style={{ border: 'none', width: '140%', transform: 'scale(0.7)', transformOrigin: 'top left' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <Wand2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">왼쪽에서 주제를 입력하고 PPT를 생성해보세요</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 