"use client";

import { useState } from "react";
import Header from '../../components/Header';
import {
  ArrowLeft, FileText, Search as SearchIcon, BookOpen, Download, Copy, Loader2, Upload, Link, Globe, X, Plus
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ReportWriter() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>(['']);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'input' | 'generating' | 'complete'>('input');
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // AI 추천 주제 생성
  const generateSuggestedTopics = async (inputTopic: string) => {
    if (!inputTopic.trim()) return;
    
    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/suggest-topics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic: inputTopic.trim() }),
      });

      const data = await response.json();
      
      if (response.ok && data.suggestions) {
        setSuggestedTopics(data.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('추천 주제 생성 오류:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // 추천 주제 선택
  const selectSuggestedTopic = (selectedTopic: string) => {
    setTopic(selectedTopic);
    setShowSuggestions(false);
  };

  // 주제 입력 변경 시 추천 주제 생성
  const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTopic(value);
    
    // 입력값이 변경되면 추천 주제 숨기기
    if (showSuggestions) {
      setShowSuggestions(false);
    }
  };

  // 주제 입력 완료 후 추천 주제 생성
  const handleTopicBlur = () => {
    if (topic.trim() && !showSuggestions) {
      generateSuggestedTopics(topic);
    }
  };

  const handleGenerateReport = async () => {
    if (!topic.trim()) {
      setError('주제를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setCurrentStep('generating');
    
    try {
      const formData = new FormData();
      formData.append('topic', topic.trim());
      formData.append('pageCount', pageCount.toString());
      
      // 파일들 추가
      uploadedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file);
      });
      
      // URL들 추가
      urls.filter(url => url.trim()).forEach((url, index) => {
        formData.append(`url_${index}`, url.trim());
      });

      const response = await fetch('/api/report-writer', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '레포트 생성에 실패했습니다.');
      }
      
      if (data.report) {
        setReport(data.report);
        setCurrentStep('complete');
      } else {
        throw new Error('레포트 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('레포트 생성 오류:', error);
      setError(error instanceof Error ? error.message : '레포트 생성 중 오류가 발생했습니다.');
      setCurrentStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      // 복사 완료 알림을 추가할 수 있습니다
    }
  };

  const handleDownloadReport = () => {
    if (report) {
      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${topic.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_레포트.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const resetForm = () => {
    setTopic('');
    setPageCount(1);
    setUploadedFiles([]);
    setUrls(['']);
    setReport(null);
    setError(null);
    setCurrentStep('input');
    setSuggestedTopics([]);
    setShowSuggestions(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (uploadedFiles.length + files.length > 3) {
      setError('최대 3개까지만 업로드 가능합니다.');
      return;
    }
    
    const validFiles = files.filter(file => {
      const validTypes = ['.pdf', '.docx', '.hwp', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      return validTypes.includes(fileExtension) && file.size <= 10 * 1024 * 1024; // 10MB
    });
    
    setUploadedFiles([...uploadedFiles, ...validFiles]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const addUrl = () => {
    if (urls.length < 2) {
      setUrls([...urls, '']);
    }
  };

  const removeUrl = (index: number) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index));
    }
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Header />
      <div className="p-8">
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
            <h1 className="text-3xl font-bold text-gray-900">AI 레포트 작성</h1>
            <p className="text-gray-600 text-lg mt-2">
              주제와 참고 자료를 입력하면 AI가 전문적인 레포트를 작성해드립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 입력 영역 */}
            <div className="space-y-6">
              {/* 레포트 주제 입력 */}
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                    레포트 주제 입력
                  </h2>
                  <p className="text-xs text-gray-500">레포트 주제 입력시 자동으로 제목을 추천해드립니다</p>
                </div>
                
                <div className="space-y-4">
                  <label className="font-semibold text-gray-700 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    레포트 주제
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="예: ChatGPT가 교육에 미치는 영향"
                      value={topic}
                      onChange={handleTopicChange}
                      onBlur={handleTopicBlur}
                      className="w-full p-4 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white shadow-sm"
                      disabled={loading}
                    />
                    <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                  
                  <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
                    💡 <strong>팁:</strong> 구체적인 주제를 입력하면 더 정확한 레포트를 받을 수 있습니다.
                  </div>

                  {/* AI 추천 주제 */}
                  {showSuggestions && (
                    <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-200">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-full"></div>
                        <h3 className="text-sm font-semibold text-gray-800">AI가 추천하는 레포트 주제</h3>
                      </div>
                      
                      {loadingSuggestions ? (
                        <div className="flex items-center justify-center py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-gray-600 font-medium">추천 주제를 생성하고 있습니다...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {suggestedTopics.map((suggestedTopic, index) => (
                            <button
                              key={index}
                              onClick={() => selectSuggestedTopic(suggestedTopic)}
                              className="w-full text-left p-3 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all duration-200 group shadow-sm hover:shadow-md"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                                    {index + 1}
                                  </div>
                                  <span className="text-gray-700 group-hover:text-blue-700 font-medium text-sm">
                                    {suggestedTopic}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
                                    선택
                                  </span>
                                  <div className="w-2 h-2 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs text-gray-500">
                          💡 추천 주제를 클릭하면 자동으로 선택됩니다
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 로딩 중일 때 표시할 애니메이션 */}
                  {loadingSuggestions && !showSuggestions && (
                    <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-center py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-gray-600 font-medium">AI가 추천 주제를 분석하고 있습니다...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 페이지 수 설정 */}
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-full"></div>
                    과제의 분량을 알려주세요
                  </h2>
                  <button
                    onClick={() => setPageCount(3)}
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all duration-200"
                  >
                    자동 설정
                  </button>
                </div>
                
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">최대 5페이지까지 설정할 수 있어요</p>
                  
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={() => setPageCount(Math.max(1, pageCount - 1))}
                      disabled={pageCount <= 1}
                      className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                    >
                      <span className="text-gray-600 font-bold">-</span>
                    </button>
                    
                    <span className="text-2xl font-bold text-blue-600 min-w-[80px] text-center">
                      {pageCount} 페이지
                    </span>
                    
                    <button
                      onClick={() => setPageCount(Math.min(5, pageCount + 1))}
                      disabled={pageCount >= 5}
                      className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-all"
                    >
                      <span className="text-gray-600 font-bold">+</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 보충자료 업로드 */}
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"></div>
                  보충자료를 첨부해 주세요 (선택)
                </h2>
                
                <div className="space-y-4">
                  {/* 파일 업로드 */}
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600 mb-2">여기에 파일을 업로드해 주세요</p>
                    <p className="text-sm text-gray-500 mb-4">.pdf, .docx, .hwp, .txt</p>
                    <p className="text-xs text-gray-400">3개까지 업로드 가능 (파일 1개당 10MB 이하)</p>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.hwp,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                      disabled={uploadedFiles.length >= 3}
                    />
                    <label
                      htmlFor="file-upload"
                      className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
                    >
                      파일 선택
                    </label>
                  </div>

                  {/* 업로드된 파일 목록 */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="text-sm text-gray-700">{file.name}</span>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* URL 입력 */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Link className="w-5 h-5 text-blue-500" />
                      <span className="text-gray-700 font-medium">URL을 입력해 주세요</span>
                      <span className="text-sm text-gray-500">2개까지 입력 가능</span>
                    </div>
                    
                    {urls.map((url, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="flex-1 relative">
                          <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="url"
                            placeholder="https://"
                            value={url}
                            onChange={(e) => updateUrl(index, e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        {urls.length > 1 && (
                          <button
                            onClick={() => removeUrl(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {urls.length < 2 && (
                      <button
                        onClick={addUrl}
                        className="flex items-center space-x-2 text-blue-500 hover:text-blue-700 text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>URL 추가</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 레포트 생성 버튼 */}
              <button
                onClick={handleGenerateReport}
                disabled={!topic.trim() || loading}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    레포트 생성 중...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    레포트 생성
                  </div>
                )}
              </button>
              
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-800 font-medium">오류 발생</div>
                  <div className="text-red-600 text-sm mt-1">{error}</div>
                </div>
              )}

              {/* 진행 상황 표시 */}
              {currentStep === 'generating' && (
                <div className="mt-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-center space-x-4">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-blue-800 font-medium">AI가 레포트를 작성하고 있습니다...</div>
                  </div>
                  <div className="mt-4 text-sm text-blue-600 text-center">
                    주제를 분석하고 체계적인 레포트를 생성하고 있어요
                  </div>
                </div>
              )}
            </div>

            {/* 결과 영역 */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"></div>
                레포트 결과
              </h2>
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 min-h-[500px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                      <div className="text-gray-600 font-medium">레포트를 생성하고 있습니다...</div>
                      <div className="text-sm text-gray-500 mt-2">AI가 논문을 분석하고 체계적인 레포트를 작성해요</div>
                    </div>
                  </div>
                ) : report ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                      <div className="whitespace-pre-wrap text-gray-800 leading-relaxed font-medium">
                        {report}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleDownloadReport}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                      >
                        <Download className="w-4 h-4" />
                        다운로드
                      </button>
                      <button 
                        onClick={handleCopyReport}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                      >
                        <Copy className="w-4 h-4" />
                        복사
                      </button>
                      <button 
                        onClick={resetForm}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                      >
                        새로 작성
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-500">
                      <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <div className="font-medium">레포트 결과가 여기에 표시됩니다</div>
                      <div className="text-sm mt-2">주제를 입력하고 레포트 생성을 시작해주세요</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 