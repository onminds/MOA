"use client";
import React, { useState, useRef, useEffect } from "react";
import Header from '../../components/Header';
import {
  ArrowLeft, Code, Download, Copy, Loader2, FileCode, Play, Lightbulb, GitBranch, Zap, MessageCircle, Settings, ChevronDown, Brain, BarChart3, Globe, RotateCcw, History, Trash2, Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GeneratedCode {
  code: string;
  explanation: string;
  usage: string;
  improvements: string[];
  relatedConcepts: string[];
}

interface HistoryItem {
  id: number;
  requestText: string;
  generatedCode: string;
  language: string;
  complexity: string;
  createdAt: string;
  updatedAt: string;
}

interface QuickStartTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  prompt: string;
}

export default function CodeGenerate() {
  const router = useRouter();
  const [language, setLanguage] = useState('javascript');
  const [request, setRequest] = useState('');
  const [complexity, setComplexity] = useState('easy');
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [codeHistory, setCodeHistory] = useState<GeneratedCode[]>([]);
  const [dbHistory, setDbHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const programmingLanguages = [
    { value: 'javascript', label: 'JavaScript (웹 프로그래밍)' },
    { value: 'python', label: 'Python (데이터 분석)' },
    { value: 'java', label: 'Java (엔터프라이즈)' },
    { value: 'cpp', label: 'C++ (시스템 프로그래밍)' },
    { value: 'html', label: 'HTML/CSS (웹 디자인)' },
    { value: 'sql', label: 'SQL (데이터베이스)' },
  ];

  const quickStartTemplates: QuickStartTemplate[] = [
    {
      id: 'simple-function',
      title: '간단한 함수 만들기',
      description: '두 숫자를 더하는 함수를 만들어주세요',
      icon: <FileCode className="w-5 h-5 text-red-500" />,
      prompt: '두 숫자를 더하는 함수를 만들어주세요'
    },
    {
      id: 'data-processing',
      title: '데이터 처리하기',
      description: '학생들의 점수 평균을 계산하는 코드를 만들어주세요',
      icon: <BarChart3 className="w-5 h-5 text-blue-500" />,
      prompt: '학생들의 점수 평균을 계산하는 코드를 만들어주세요'
    },
    {
      id: 'webpage',
      title: '웹페이지 만들기',
      description: '간단한 회원가입 폼을 만들어주세요',
      icon: <Globe className="w-5 h-5 text-green-500" />,
      prompt: '간단한 회원가입 폼을 만들어주세요'
    },
    {
      id: 'loop',
      title: '반복 작업하기',
      description: '1부터 100까지 숫자를 출력하는 코드를 만들어주세요',
      icon: <RotateCcw className="w-5 h-5 text-purple-500" />,
      prompt: '1부터 100까지 숫자를 출력하는 코드를 만들어주세요'
    }
  ];

  // 히스토리 로드
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/code-generate/history');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setDbHistory(data.history);
        console.log('📋 히스토리 로드 완료:', data.count + '개');
      } else {
        console.error('❌ 히스토리 로드 실패:', data.error);
      }
    } catch (error) {
      console.error('❌ 히스토리 로드 중 오류:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 히스토리 삭제
  const deleteHistoryItem = async (id: number) => {
    try {
      const response = await fetch(`/api/code-generate/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setDbHistory(prev => prev.filter(item => item.id !== id));
        console.log('🗑️ 히스토리 항목 삭제 완료:', id);
      } else {
        console.error('❌ 히스토리 삭제 실패');
      }
    } catch (error) {
      console.error('❌ 히스토리 삭제 중 오류:', error);
    }
  };

  // 히스토리 항목 클릭 시 코드 표시
  const loadHistoryItem = (item: HistoryItem) => {
    const generatedCode: GeneratedCode = {
      code: item.generatedCode,
      explanation: `요청: ${item.requestText}`,
      usage: `${item.language} 언어로 작성된 코드입니다.`,
      improvements: [],
      relatedConcepts: [item.language, item.complexity]
    };
    setGeneratedCode(generatedCode);
    
    // 결과 영역으로 스크롤
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

  // 페이지 로드 시 히스토리 자동 로드
  useEffect(() => {
    loadHistory();
  }, []);

  const handleQuickStart = (template: QuickStartTemplate) => {
    setRequest(template.prompt);
  };

  const generateCode = async () => {
    if (!request.trim()) {
      setError('코드 요청사항을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/code-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language,
          request,
          complexity,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '코드 생성에 실패했습니다.');
      }
      
      if (data.result && data.result.code) {
        const newCode = data.result;
        setGeneratedCode(newCode);
        
        // 히스토리에 추가
        setCodeHistory(prev => [newCode, ...prev.slice(0, 9)]); // 최대 10개 유지
        
        // DB에 저장
        try {
          const saveResponse = await fetch('/api/code-generate/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requestText: request,
              generatedCode: newCode.code,
              language: language,
              complexity: complexity,
            }),
          });
          
          if (saveResponse.ok) {
            console.log('✅ 코드 생성 결과 DB 저장 완료');
            // 히스토리 새로고침
            loadHistory();
          } else {
            console.error('❌ DB 저장 실패');
          }
        } catch (saveError) {
          console.error('❌ DB 저장 중 오류:', saveError);
        }
        
        // 결과 영역으로 스크롤
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }, 100);
      } else {
        throw new Error('코드를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('코드 생성 오류:', error);
      setError(error instanceof Error ? error.message : '코드 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="min-h-screen bg-gray-50 p-8">
                        <div className="max-w-4xl mx-auto">
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
            <h1 className="text-3xl font-bold text-gray-900">코드 생성</h1>
            <p className="text-gray-600 text-lg mt-2">
              자연어로 설명하면 AI가 코드를 생성해드립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 입력 영역 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-md p-8">
                {/* 빠른 시작 */}
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-green-600" />
                    어떤 코드가 필요하신가요?
                  </h2>
                  <p className="text-sm text-gray-600 mb-4">빠른 시작 (클릭하면 자동으로 입력됩니다)</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quickStartTemplates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => handleQuickStart(template)}
                        className="p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-all text-left"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          {template.icon}
                          <h3 className="font-medium text-gray-900">{template.title}</h3>
                        </div>
                        <p className="text-sm text-gray-600">{template.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 직접 설명 */}
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    또는 직접 설명해주세요 *
                  </h2>
                  <textarea
                    value={request}
                    onChange={(e) => setRequest(e.target.value)}
                    placeholder="예: 학생 성적을 관리하는 프로그램을 만들어주세요"
                    rows={6}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500 text-black resize-none"
                  />
                  <div className="flex items-center gap-2 mt-2 text-sm text-yellow-600">
                    <Lightbulb className="w-4 h-4" />
                    팁: 구체적으로 설명할수록 더 정확한 코드를 만들어드려요!
                  </div>
                </div>

                {/* 기본 설정 */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-green-600" />
                    기본 설정
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Code className="w-4 h-4" />
                        프로그래밍 언어
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                      >
                        {programmingLanguages.map((lang) => (
                          <option key={lang.value} value={lang.value}>
                            {lang.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        난이도
                      </label>
                      <select
                        value={complexity}
                        onChange={(e) => setComplexity(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                      >
                        <option value="easy">쉬운 버전 (처음 배우는 분께 추천)</option>
                        <option value="intermediate">일반 버전</option>
                        <option value="advanced">고급 버전</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 더 자세한 설정 */}
                <div className="mb-8">
                  <button
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
                    더 자세한 설정
                  </button>
                  
                  {showAdvancedSettings && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        추가 설정 옵션들이 여기에 표시됩니다.
                      </p>
                    </div>
                  )}
                </div>

                {/* 생성 버튼 */}
                <div className="text-center">
                  <button
                    onClick={generateCode}
                    disabled={loading || !request.trim()}
                    className="w-full bg-green-500 text-white py-4 rounded-xl hover:bg-green-600 transition-all font-semibold text-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        AI가 코드를 생성하고 있어요...
                      </>
                    ) : (
                      <>
                        <Brain className="w-6 h-6" />
                        AI에게 코드 만들어달라고 하기!
                      </>
                    )}
                  </button>
                  <p className="text-sm text-gray-600 mt-3">
                    {!request.trim() ? '위에서 무엇을 만들지 먼저 설명해주세요!' : '코드 생성을 시작할 준비가 되었어요!'}
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-red-800 font-medium">오류 발생</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                  </div>
                )}
              </div>

                             {/* 결과 영역 */}
               {generatedCode && (
                 <div ref={resultRef} className="bg-white rounded-lg shadow-md p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Code className="w-6 h-6" />
                    생성된 코드
                  </h3>

                  <div className="space-y-6">
                    {/* 코드 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <FileCode className="w-4 h-4" />
                          코드
                        </h4>
                        <button
                          onClick={() => copyCode(generatedCode.code)}
                          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 transition-colors flex items-center gap-2"
                        >
                          <Copy className="w-3 h-3" />
                          복사
                        </button>
                      </div>
                      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                        <code>{generatedCode.code}</code>
                      </pre>
                    </div>

                    {/* 코드 설명 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4" />
                          코드 설명
                        </h4>
                        <p className="text-blue-800 text-sm leading-relaxed">{generatedCode.explanation}</p>
                      </div>

                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                          <Play className="w-4 h-4" />
                          사용 방법
                        </h4>
                        <p className="text-green-800 text-sm leading-relaxed">{generatedCode.usage}</p>
                      </div>
                    </div>

                    {/* 개선 제안 */}
                    {generatedCode.improvements && generatedCode.improvements.length > 0 && (
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                          <GitBranch className="w-4 h-4" />
                          개선 제안
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {generatedCode.improvements.map((improvement, idx) => (
                            <li key={idx} className="text-yellow-800 text-sm">{improvement}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 관련 개념 */}
                    {generatedCode.relatedConcepts && generatedCode.relatedConcepts.length > 0 && (
                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-3">관련 개념</h4>
                        <div className="flex flex-wrap gap-2">
                          {generatedCode.relatedConcepts.map((concept, idx) => (
                            <span key={idx} className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm">
                              {concept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

                         {/* 히스토리 패널 */}
             <div className="lg:col-span-1">
               <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
                 <div className="flex items-center justify-between mb-4">
                   <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
                     <History className="w-4 h-4" />
                     코드 히스토리 ({dbHistory.length})
                   </h3>
                                       <button
                      onClick={() => loadHistory()}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                    >
                      <Loader2 className="w-3 h-3" />
                      새로고침
                    </button>
                 </div>

                 {loadingHistory ? (
                   <div className="text-center py-8">
                     <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                     <p className="text-gray-500 text-sm">히스토리를 불러오는 중...</p>
                   </div>
                 ) : dbHistory.length === 0 ? (
                   <div className="text-center py-8">
                     <Code className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                     <p className="text-gray-500 text-sm">
                       아직 저장된 코드가 없어요!<br />
                       첫 번째 코드를 만들어보세요!
                     </p>
                   </div>
                 ) : (
                   <div className="space-y-3 max-h-96 overflow-y-auto">
                     {dbHistory.map((item) => (
                       <div key={item.id} className="border border-gray-200 rounded-lg p-3 hover:border-green-300 transition-colors">
                         <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-2">
                             <FileCode className="w-4 h-4 text-green-600" />
                             <span className="text-sm font-medium text-gray-900 truncate">
                               {item.requestText.substring(0, 25)}...
                             </span>
                           </div>
                           <button
                             onClick={(e) => {
                               e.stopPropagation();
                               deleteHistoryItem(item.id);
                             }}
                             className="text-red-500 hover:text-red-700 transition-colors"
                             title="삭제"
                           >
                             <Trash2 className="w-3 h-3" />
                           </button>
                         </div>
                         <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                           {item.generatedCode.substring(0, 50)}...
                         </p>
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                               {item.language}
                             </span>
                             <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                               {item.complexity}
                             </span>
                           </div>
                           <div className="flex items-center gap-1 text-xs text-gray-500">
                             <Clock className="w-3 h-3" />
                             {new Date(item.createdAt).toLocaleDateString()}
                           </div>
                         </div>
                         <button
                           onClick={() => loadHistoryItem(item)}
                           className="w-full mt-2 text-xs bg-green-100 text-green-800 py-1 rounded hover:bg-green-200 transition-colors"
                         >
                           코드 보기
                         </button>
                       </div>
                     ))}
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