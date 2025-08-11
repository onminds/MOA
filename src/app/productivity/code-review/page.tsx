"use client";
import React, { useState, useEffect, useRef } from "react";
import Header from '../../components/Header';
import {
  ArrowLeft, Eye, Copy, Loader2, FileCode, CheckCircle, Bug, AlertCircle, TrendingUp, MessageCircle, Zap, Settings, Search, Sun, Brain, Rocket, ToggleLeft, ToggleRight, History, Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CodeReviewResult {
  detectedLanguage?: string;
  overallScore: number;
  scores: {
    readability: number;
    maintainability: number;
    performance: number;
    security: number;
    bestPractices: number;
  };
  issues: {
    level: 'error' | 'warning' | 'info';
    type: string;
    message: string;
    line?: number;
    suggestion: string;
  }[];
  improvements: string[];
  positives: string[];
  refactoredCode?: string;
  annotatedCode?: string;
  summary: string;
}

interface CodeReviewHistory {
  id: number;
  codeContent: string;
  detectedLanguage: string;
  overallScore: number;
  summary: string;
  scores: {
    readability: number;
    maintainability: number;
    performance: number;
    security: number;
    bestPractices: number;
  };
  issues: {
    level: 'error' | 'warning' | 'info';
    type: string;
    message: string;
    line?: number;
    suggestion: string;
  }[];
  improvements: string[];
  positives: string[];
  refactoredCode?: string;
  createdAt: string;
  updatedAt: string;
}

interface CodeGenerationHistory {
  id: number;
  requestText: string;
  generatedCode: string;
  language: string;
  complexity: string;
  createdAt: string;
  updatedAt: string;
}

export default function CodeReview() {
  const router = useRouter();
  const resultRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState('');
  const [codeDescription, setCodeDescription] = useState('');
  const [autoDetectLanguage, setAutoDetectLanguage] = useState(true);
  const [reviewScope, setReviewScope] = useState('comprehensive');
  const [reviewResult, setReviewResult] = useState<CodeReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewHistory, setReviewHistory] = useState<CodeReviewHistory[]>([]);
  const [detectedLanguage, setDetectedLanguage] = useState<string>(''); // 파일에서 감지한 언어
  const [codeGenerationHistory, setCodeGenerationHistory] = useState<CodeGenerationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showCodeHistory, setShowCodeHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'reviewed' | 'generated'>('reviewed');

  const reviewScopes = [
    {
      value: 'comprehensive',
      label: '전체적으로 봐주세요 (추천)',
      icon: <Sun className="w-4 h-4" />,
      description: '전체 리뷰: 코드 품질, 성능, 보안 등 종합 검토'
    },
    {
      value: 'security',
      label: '보안 위험만 찾아주세요',
      icon: <AlertCircle className="w-4 h-4" />,
      description: '보안 리뷰: 취약점, 보안 위험 요소만 검토'
    },
    {
      value: 'performance',
      label: '성능 개선점만 찾아주세요',
      icon: <TrendingUp className="w-4 h-4" />,
      description: '성능 리뷰: 최적화, 성능 개선점만 검토'
    },
    {
      value: 'readability',
      label: '가독성 개선점만 찾아주세요',
      icon: <Eye className="w-4 h-4" />,
      description: '가독성 리뷰: 코드 구조, 명명 규칙 등 검토'
    }
  ];

  const performReview = async () => {
    if (!code.trim()) {
      setError('코드를 입력해주세요.');
      return;
    }

    if (code.length > 8000) {
      setError('코드가 너무 깁니다. 8,000자 이하로 줄여주세요. (현재: ' + code.length + '자)');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/code-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code.trim(),
          description: codeDescription.trim(),
          autoDetectLanguage,
          reviewScope,
          detectedLanguage: detectedLanguage || undefined, // 파일에서 감지한 언어 전달
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '코드 검사에 실패했습니다.');
      }
      
      if (data.review) {
        // API 응답을 프론트엔드 형식에 맞게 변환
        const scores = data.scores || {
          readability: 70,
          maintainability: 75,
          performance: 80,
          security: 85,
          bestPractices: 70
        };
        
        // 종합 점수 계산 (가중 평균)
        const overallScore = Math.round(
          (scores.readability * 0.2 + 
           scores.maintainability * 0.2 + 
           scores.performance * 0.2 + 
           scores.security * 0.25 + 
           scores.bestPractices * 0.15)
        );
        
        const result: CodeReviewResult = {
          detectedLanguage: data.detectedLanguage || 'unknown',
          overallScore: overallScore,
          scores: scores,
          issues: data.issues || [],
          improvements: data.improvements || [],
          positives: data.positives || [],
          refactoredCode: data.refactoredCode,
          summary: data.review
        };
        
        setReviewResult(result);
        
        // DB에 저장
        await saveReviewResult(result);
        
        // 결과 영역으로 자동 스크롤
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }, 100);
      } else {
        throw new Error('검사 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('코드 검사 오류:', error);
      setError(error instanceof Error ? error.message : '코드 검사 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getIssueColor = (level: string) => {
    switch (level) {
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'info': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getIssueIcon = (level: string) => {
    switch (level) {
      case 'error': return <Bug className="w-5 h-5 text-red-500 flex-shrink-0" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />;
      case 'info': return <MessageCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />;
      default: return <MessageCircle className="w-5 h-5 text-gray-500 flex-shrink-0" />;
    }
  };

  // 언어별 아이콘과 색상 매핑
  const getLanguageInfo = (language: string) => {
    const languageMap: { [key: string]: { icon: string; color: string; name: string } } = {
      cpp: { icon: '⚙️', color: 'bg-blue-100 text-blue-800', name: 'C++' },
      javascript: { icon: '💛', color: 'bg-yellow-100 text-yellow-800', name: 'JavaScript' },
      typescript: { icon: '💙', color: 'bg-blue-100 text-blue-800', name: 'TypeScript' },
      react: { icon: '⚛️', color: 'bg-cyan-100 text-cyan-800', name: 'React' },
      vue: { icon: '💚', color: 'bg-green-100 text-green-800', name: 'Vue.js' },
      python: { icon: '🐍', color: 'bg-green-100 text-green-800', name: 'Python' },
      java: { icon: '☕', color: 'bg-orange-100 text-orange-800', name: 'Java' },
      csharp: { icon: '🔷', color: 'bg-purple-100 text-purple-800', name: 'C#' },
      php: { icon: '🐘', color: 'bg-purple-100 text-purple-800', name: 'PHP' },
      go: { icon: '🐹', color: 'bg-blue-100 text-blue-800', name: 'Go' },
      rust: { icon: '🦀', color: 'bg-orange-100 text-orange-800', name: 'Rust' },
      sql: { icon: '🗄️', color: 'bg-gray-100 text-gray-800', name: 'SQL' },
      html: { icon: '🌐', color: 'bg-orange-100 text-orange-800', name: 'HTML' },
      css: { icon: '🎨', color: 'bg-blue-100 text-blue-800', name: 'CSS' },
      kotlin: { icon: '🔶', color: 'bg-orange-100 text-orange-800', name: 'Kotlin' },
      swift: { icon: '🍎', color: 'bg-red-100 text-red-800', name: 'Swift' },
      unknown: { icon: '❓', color: 'bg-gray-100 text-gray-800', name: 'Unknown' }
    };
    
    return languageMap[language.toLowerCase()] || languageMap.unknown;
  };

  // 파일 확장자로 언어 감지
  const detectLanguageFromExtension = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'react',
      'ts': 'typescript',
      'tsx': 'react',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'c': 'cpp',
      'h': 'cpp',
      'hpp': 'cpp',
      'cs': 'csharp',
      'php': 'php',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'html': 'html',
      'htm': 'html',
      'css': 'css',
      'scss': 'css',
      'sass': 'css',
      'kt': 'kotlin',
      'swift': 'swift',
      'vue': 'vue',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'txt': 'text'
    };
    
    return languageMap[ext || ''] || 'unknown';
  };

  // 파일 선택 처리
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 파일 크기 체크 (8MB 제한)
    if (file.size > 8 * 1024 * 1024) {
      alert('파일이 너무 큽니다. 8MB 이하의 파일을 선택해주세요.');
      return;
    }

    // 텍스트 파일만 허용
    if (!file.type.startsWith('text/') && !file.name.match(/\.(js|jsx|ts|tsx|py|java|cpp|cc|cxx|c|h|hpp|cs|php|go|rs|sql|html|htm|css|scss|sass|kt|swift|vue|json|xml|yaml|yml|md|txt)$/i)) {
      alert('텍스트 파일만 선택할 수 있습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      // 파일 내용을 코드 영역에 설정
      setCode(content);
      
      // 파일명에서 언어 감지하여 표시
      const detectedLang = detectLanguageFromExtension(file.name);
      setDetectedLanguage(detectedLang); // 파일에서 감지한 언어를 상태에 저장
      console.log('📁 선택된 파일:', file.name, '감지된 언어:', detectedLang);
      
      // 성공 메시지 제거 - 바로 코드가 붙여넣어짐
    };
    
    reader.onerror = () => {
      alert('파일을 읽는 중 오류가 발생했습니다.');
    };
    
    reader.readAsText(file);
    
    // 파일 input 초기화
    event.target.value = '';
  };

  // 코드 리뷰 히스토리 로드
  const loadCodeReviewHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/code-review/history');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setReviewHistory(data.history);
        console.log('📋 코드 리뷰 히스토리 로드 완료:', data.count + '개');
      } else {
        console.error('❌ 코드 리뷰 히스토리 로드 실패:', data.error);
      }
    } catch (error) {
      console.error('❌ 코드 리뷰 히스토리 로드 중 오류:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 코드 생성 히스토리 로드
  const loadCodeGenerationHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/code-generate/history');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setCodeGenerationHistory(data.history);
        console.log('📋 코드 생성 히스토리 로드 완료:', data.count + '개');
      } else {
        console.error('❌ 코드 생성 히스토리 로드 실패:', data.error);
      }
    } catch (error) {
      console.error('❌ 코드 생성 히스토리 로드 중 오류:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 코드 리뷰 결과 저장
  const saveReviewResult = async (result: CodeReviewResult) => {
    try {
      const response = await fetch('/api/code-review/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeContent: code,
          reviewResult: result
        }),
      });
      
      if (response.ok) {
        console.log('✅ 코드 리뷰 결과 DB 저장 완료');
        loadCodeReviewHistory(); // 히스토리 새로고침
      } else {
        console.error('❌ DB 저장 실패');
      }
    } catch (error) {
      console.error('❌ DB 저장 중 오류:', error);
    }
  };

  // 코드 생성 히스토리에서 코드 선택
  const selectCodeFromHistory = (item: CodeGenerationHistory) => {
    setCode(item.generatedCode);
    setDetectedLanguage(item.language);
    setShowCodeHistory(false);
    console.log('✅ 코드 생성 히스토리에서 선택:', item.requestText.substring(0, 50) + '...');
  };

  // 페이지 로드 시 히스토리 자동 로드
  useEffect(() => {
    loadCodeReviewHistory();
    loadCodeGenerationHistory();
  }, []);

  // 파일 선택 버튼 클릭
  const handleProjectAnalysisClick = () => {
    document.getElementById('file-input')?.click();
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="min-h-screen bg-gray-50 p-8">
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
          <div className="flex items-center justify-between mb-8">
            <div className="text-center flex-1">
              <h1 className="text-3xl font-bold text-gray-900">코드 리뷰</h1>
              <p className="text-gray-600 text-lg mt-2">
                AI가 코드를 분석하고 개선점을 제안해드립니다.
              </p>
            </div>
            
            {/* 프로젝트 분석 버튼 */}
            <button 
              onClick={handleProjectAnalysisClick}
              className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-all font-medium flex items-center gap-2 shadow-lg"
            >
              <Rocket className="w-5 h-5" />
              프로젝트 분석
            </button>
          </div>

          {/* 숨겨진 파일 입력 */}
          <input
            id="file-input"
            type="file"
            accept=".js,.jsx,.ts,.tsx,.py,.java,.cpp,.cc,.cxx,.c,.h,.hpp,.cs,.php,.go,.rs,.sql,.html,.htm,.css,.scss,.sass,.kt,.swift,.vue,.json,.xml,.yaml,.yml,.md,.txt,text/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 입력 영역 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-md p-8">
                {/* 코드 검사 섹션 */}
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-600" />
                    코드를 검사해드릴게요!
                  </h2>
                  
                  
                  
                  <div className="mb-6">
                    <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-red-500" />
                      검사받고 싶은 코드를 붙여넣어 주세요 *
                    </h3>
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="여기에 코드를 붙여넣어 주세요... 걱정마세요, AI가 친절하게 검사해드릴게요!"
                      rows={12}
                      className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-black font-mono text-sm resize-none"
                    />
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <FileCode className="w-4 h-4" />
                        {code.length} / 8,000자
                      </div>
                      {code.length > 8000 && (
                        <div className="text-sm text-red-500">
                          코드가 너무 깁니다!
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-yellow-600 mt-2">
                      <MessageCircle className="w-4 h-4" />
                      팁: 어떤 언어든 상관없어요! AI가 알아서 분석해드립니다
                    </div>
                  </div>
                </div>

                {/* 기본 설정 */}
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-600" />
                    기본 설정
                  </h2>
                  
                  <div className="space-y-6">
                    {/* 언어 자동 감지 */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {autoDetectLanguage ? (
                            <ToggleRight className="w-6 h-6 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                          )}
                          <span className="text-sm font-medium text-green-800">
                            AI가 코드를 보고 자동으로 언어를 감지해드립니다!
                          </span>
                        </div>
                        <button
                          onClick={() => setAutoDetectLanguage(!autoDetectLanguage)}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            autoDetectLanguage
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-300 text-gray-700'
                          }`}
                        >
                          {autoDetectLanguage ? '켜짐' : '꺼짐'}
                        </button>
                      </div>
                    </div>

                    {/* 검사 범위 */}
                    <div>
                      <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        어떻게 검사할까요?
                      </h3>
                      <select
                        value={reviewScope}
                        onChange={(e) => setReviewScope(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      >
                        {reviewScopes.map((scope) => (
                          <option key={scope.value} value={scope.value}>
                            {scope.label}
                          </option>
                        ))}
                      </select>
                      
                      {/* 선택된 범위 설명 */}
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                          {reviewScopes.find(s => s.value === reviewScope)?.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 코드 설명 */}
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    코드 설명 (선택사항)
                  </h2>
                  <textarea
                    value={codeDescription}
                    onChange={(e) => setCodeDescription(e.target.value)}
                    placeholder="코드의 목적이나 특별히 검토받고 싶은 부분을 설명해주세요..."
                    rows={4}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-black resize-none"
                  />
                </div>

                {/* 검사 버튼 */}
                <div className="text-center">
                                     <button
                     onClick={performReview}
                     disabled={loading || !code.trim() || code.length > 8000}
                     className="w-full bg-blue-500 text-white py-4 rounded-xl hover:bg-blue-600 transition-all font-semibold text-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                   >
                    {loading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        AI가 코드를 검사하고 있어요...
                      </>
                    ) : (
                      <>
                        <Brain className="w-6 h-6" />
                        AI에게 코드 검사 맡기기!
                      </>
                    )}
                  </button>
                                     <p className="text-sm text-gray-600 mt-3">
                     {!code.trim() ? '위에서 코드를 먼저 붙여넣어주세요!' : 
                      code.length > 8000 ? '코드가 너무 깁니다. 8,000자 이하로 줄여주세요.' :
                      '코드 검사를 시작할 준비가 되었어요!'}
                   </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-red-800 font-medium">오류 발생</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                  </div>
                )}
              </div>

              {/* 리뷰 결과 */}
              {reviewResult && (
                <div ref={resultRef} className="bg-white rounded-lg shadow-md p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        검사 결과가 나왔어요!
                      </h3>
                      {reviewResult.detectedLanguage && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-sm text-gray-600">감지된 언어:</span>
                          <span className={`${getLanguageInfo(reviewResult.detectedLanguage).color} px-2 py-1 rounded text-sm font-medium`}>
                            {getLanguageInfo(reviewResult.detectedLanguage).icon} {getLanguageInfo(reviewResult.detectedLanguage).name}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${getScoreColor(reviewResult.overallScore)}`}>
                        {reviewResult.overallScore}/100
                      </div>
                      <div className="text-sm text-gray-600">종합 점수</div>
                    </div>
                  </div>

                                     {/* 요약 */}
                   <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                     <h4 className="font-semibold text-gray-900 mb-2">요약</h4>
                     <p className="text-gray-700 leading-relaxed">{reviewResult.summary}</p>
                   </div>

                   {/* 긍정적인 점들 */}
                   {reviewResult.positives && reviewResult.positives.length > 0 && (
                     <div className="mb-6">
                       <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                         <CheckCircle className="w-5 h-5 text-green-500" />
                         잘된 점들 ({reviewResult.positives.length}개)
                       </h4>
                       <div className="space-y-2">
                         {reviewResult.positives.map((positive, idx) => (
                           <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                             <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                             <p className="text-sm text-green-800">{positive}</p>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {/* 개선 사항들 */}
                   {reviewResult.improvements && reviewResult.improvements.length > 0 && (
                     <div className="mb-6">
                       <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                         <TrendingUp className="w-5 h-5 text-blue-500" />
                         개선 사항 ({reviewResult.improvements.length}개)
                       </h4>
                       <div className="space-y-2">
                         {reviewResult.improvements.map((improvement, idx) => (
                           <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                             <TrendingUp className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                             <p className="text-sm text-blue-800">{improvement}</p>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                  {/* 세부 점수 */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    {Object.entries(reviewResult.scores).map(([key, score]) => {
                      const labels: { [key: string]: string } = {
                        readability: '가독성',
                        maintainability: '유지보수성',
                        performance: '성능',
                        security: '보안',
                        bestPractices: '모범사례'
                      };
                      return (
                        <div key={key} className="text-center p-4 bg-gray-50 rounded-lg">
                          <div className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</div>
                          <div className="text-sm text-gray-600">{labels[key]}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 발견된 이슈들 */}
                  {reviewResult.issues && reviewResult.issues.length > 0 && (
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Bug className="w-5 h-5" />
                        발견된 이슈 ({reviewResult.issues.length}개)
                      </h4>
                      <div className="space-y-3">
                        {reviewResult.issues.map((issue, idx) => (
                          <div key={idx} className={`p-4 border rounded-lg ${getIssueColor(issue.level)}`}>
                            <div className="flex items-start gap-3">
                              {getIssueIcon(issue.level)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{issue.type}</span>
                                  {issue.line && (
                                    <span className="text-xs bg-white px-2 py-1 rounded">
                                      Line {issue.line}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm mb-2">{issue.message}</p>
                                <p className="text-xs text-gray-600">
                                  💡 <strong>제안:</strong> {issue.suggestion}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 개선된 코드 */}
                  {reviewResult.refactoredCode && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          개선된 코드 제안
                        </h4>
                        <button
                          onClick={() => copyCode(reviewResult.refactoredCode!)}
                          className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 transition-colors flex items-center gap-2"
                        >
                          <Copy className="w-3 h-3" />
                          복사
                        </button>
                      </div>
                      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                        <code>{reviewResult.refactoredCode}</code>
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

                                                  {/* 히스토리 패널 */}
             <div className="lg:col-span-1">
               <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
                 {/* 탭 헤더 */}
                 <div className="flex items-center justify-between mb-4">
                   <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
                     <FileCode className="w-4 h-4" />
                     코드 히스토리
                   </h3>
                   <div className="text-xs text-gray-500">
                     최근 24시간 기준
                   </div>
                 </div>

                 {/* 탭 네비게이션 */}
                 <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
                   <button
                     onClick={() => setActiveTab('reviewed')}
                     className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                       activeTab === 'reviewed'
                         ? 'bg-blue-500 text-white'
                         : 'text-gray-600 hover:text-gray-800'
                     }`}
                   >
                     검사한 코드들 ({reviewHistory.length})
                   </button>
                   <button
                     onClick={() => setActiveTab('generated')}
                     className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                       activeTab === 'generated'
                         ? 'bg-blue-500 text-white'
                         : 'text-gray-600 hover:text-gray-800'
                     }`}
                   >
                     생성한 코드들 ({codeGenerationHistory.length})
                   </button>
                 </div>

                 {/* 탭 컨텐츠 */}
                 {activeTab === 'reviewed' ? (
                   // 검사한 코드들 탭
                   <div>
                     {reviewHistory.length === 0 ? (
                       <div className="text-center py-8">
                         <Eye className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                         <p className="text-gray-500 text-sm">
                           아직 검사한 코드가 없어요!<br />
                           첫 번째 코드 검사를 시작해보세요!
                         </p>
                       </div>
                     ) : (
                                               <div className="space-y-4 max-h-96 overflow-y-auto">
                          {reviewHistory.map((review) => (
                            <div key={review.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => {
                              const result: CodeReviewResult = {
                                detectedLanguage: review.detectedLanguage,
                                overallScore: review.overallScore,
                                scores: review.scores,
                                issues: review.issues,
                                improvements: review.improvements,
                                positives: review.positives,
                                refactoredCode: review.refactoredCode,
                                summary: review.summary
                              };
                              setReviewResult(result);
                            }}>
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm font-medium text-gray-900 truncate">
                                  {review.summary.substring(0, 30)}...
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {review.detectedLanguage}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded font-medium ${getScoreColor(review.overallScore)}`}>
                                  {review.overallScore}/100
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                  {new Date(review.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                     )}
                   </div>
                 ) : (
                   // 생성한 코드들 탭
                   <div>
                     {loadingHistory ? (
                       <div className="text-center py-8">
                         <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                         <p className="text-gray-500 text-sm">히스토리를 불러오는 중...</p>
                       </div>
                     ) : codeGenerationHistory.length === 0 ? (
                       <div className="text-center py-8">
                         <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                         <p className="text-gray-500 text-sm">
                           아직 생성한 코드가 없어요!<br />
                           코드 생성 도구에서 코드를 만들어보세요!
                         </p>
                       </div>
                     ) : (
                       <div className="space-y-4 max-h-96 overflow-y-auto">
                         {codeGenerationHistory.map((item) => (
                           <div
                             key={item.id}
                             onClick={() => selectCodeFromHistory(item)}
                             className="border border-gray-200 rounded-lg p-3 hover:border-green-300 hover:bg-green-50 transition-colors cursor-pointer"
                           >
                             <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-2">
                                 <FileCode className="w-4 h-4 text-green-600" />
                                 <span className="text-sm font-medium text-gray-900 truncate">
                                   {item.requestText.substring(0, 30)}...
                                 </span>
                               </div>
                               <div className="flex items-center gap-1 text-xs text-gray-500">
                                 <Clock className="w-3 h-3" />
                                 {new Date(item.createdAt).toLocaleDateString()}
                               </div>
                             </div>
                             <p className="text-xs text-gray-500 line-clamp-2 mb-2">
                               {item.generatedCode.substring(0, 50)}...
                             </p>
                             <div className="flex items-center gap-2">
                               <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                 {item.language}
                               </span>
                               <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                 {item.complexity}
                               </span>
                             </div>
                           </div>
                         ))}
                       </div>
                     )}
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