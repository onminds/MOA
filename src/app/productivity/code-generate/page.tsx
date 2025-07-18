"use client";
import { useState, useCallback } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  ArrowLeft, Code, Copy, Download, Loader2, CheckCircle, AlertCircle, Play, FileCode,
  Zap, Brain, Lightbulb, Terminal, GitBranch, Database, Globe, Smartphone, Box
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const sideMenus = [
  { name: '홈', icon: <HomeIcon className="w-5 h-5 mr-2" />, href: '/' },
  { name: '검색', icon: <Search className="w-5 h-5 mr-2" />, href: '#' },
  { name: 'AI 목록', icon: <List className="w-5 h-5 mr-2" />, href: '#' },
  { name: '순위', icon: <BarChart className="w-5 h-5 mr-2" />, href: '#' },
  { name: '광고', icon: <Megaphone className="w-5 h-5 mr-2" />, href: '#' },
  { name: 'AI 뉴스', icon: <Newspaper className="w-5 h-5 mr-2" />, href: '#' },
  { name: '문의하기', icon: <MessageCircle className="w-5 h-5 mr-2" />, href: '#' },
  { name: '설정', icon: <Settings className="w-5 h-5 mr-2" />, href: '#' },
];

const programmingLanguages = [
  { value: 'javascript', label: 'JavaScript', icon: '🟨' },
  { value: 'typescript', label: 'TypeScript', icon: '🔷' },
  { value: 'python', label: 'Python', icon: '🐍' },
  { value: 'java', label: 'Java', icon: '☕' },
  { value: 'cpp', label: 'C++', icon: '⚡' },
  { value: 'csharp', label: 'C#', icon: '🔵' },
  { value: 'go', label: 'Go', icon: '🐹' },
  { value: 'rust', label: 'Rust', icon: '🦀' },
  { value: 'php', label: 'PHP', icon: '🐘' },
  { value: 'ruby', label: 'Ruby', icon: '💎' },
  { value: 'swift', label: 'Swift', icon: '🕊️' },
  { value: 'kotlin', label: 'Kotlin', icon: '🎯' }
];

const codeTypes = [
  { value: 'function', label: '함수', icon: <Zap className="w-4 h-4" /> },
  { value: 'class', label: '클래스', icon: <Box className="w-4 h-4" /> },
  { value: 'api', label: 'API 엔드포인트', icon: <Globe className="w-4 h-4" /> },
  { value: 'component', label: 'UI 컴포넌트', icon: <Smartphone className="w-4 h-4" /> },
  { value: 'algorithm', label: '알고리즘', icon: <Brain className="w-4 h-4" /> },
  { value: 'database', label: 'DB 쿼리', icon: <Database className="w-4 h-4" /> },
  { value: 'script', label: '스크립트', icon: <Terminal className="w-4 h-4" /> },
  { value: 'test', label: '테스트 코드', icon: <CheckCircle className="w-4 h-4" /> }
];

const quickTemplates = [
  { 
    title: '📝 간단한 함수 만들기', 
    example: '두 숫자를 더하는 함수를 만들어주세요',
    language: 'javascript',
    type: 'function'
  },
  { 
    title: '📊 데이터 처리하기', 
    example: '학생들의 점수 평균을 계산하는 코드를 만들어주세요',
    language: 'python',
    type: 'function'
  },
  { 
    title: '🌐 웹페이지 만들기', 
    example: '간단한 회원가입 폼을 만들어주세요',
    language: 'javascript',
    type: 'component'
  },
  { 
    title: '🔄 반복 작업하기', 
    example: '1부터 100까지 숫자를 출력하는 코드를 만들어주세요',
    language: 'python',
    type: 'script'
  }
];

interface GeneratedCode {
  code: string;
  explanation: string;
  usage: string;
  improvements: string[];
  relatedConcepts: string[];
}

export default function ProductivityCodeGenerate() {
  const router = useRouter();
  
  // 입력 상태
  const [request, setRequest] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [codeType, setCodeType] = useState('function');
  const [complexity, setComplexity] = useState('simple'); // 초보자를 위해 기본값을 simple로 변경
  const [requirements, setRequirements] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expertMode, setExpertMode] = useState(false);
  
  // 결과 상태
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 히스토리
  const [codeHistory, setCodeHistory] = useState<Array<{
    id: number;
    request: string;
    language: string;
    code: string;
    timestamp: Date;
  }>>([]);

  // 코드 생성
  const generateCode = async () => {
    if (!request.trim()) {
      setError('코드 요청사항을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedCode(null);

    try {
      const response = await fetch('/api/code-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request: request.trim(),
          language,
          codeType,
          complexity,
          requirements: requirements.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '코드 생성에 실패했습니다.');
      }

      const data = await response.json();
      
      if (data.success && data.result) {
        setGeneratedCode(data.result);
        
        // 히스토리에 추가
        const newHistoryItem = {
          id: Date.now(),
          request: request.trim(),
          language,
          code: data.result.code,
          timestamp: new Date()
        };
        setCodeHistory(prev => [newHistoryItem, ...prev.slice(0, 9)]); // 최대 10개 유지
      } else {
        throw new Error('코드 생성 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('코드 생성 오류:', error);
      setError(error instanceof Error ? error.message : '코드 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 코드 복사
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    // TODO: 토스트 알림 추가
  };

  // 코드 다운로드
  const downloadCode = (code: string, filename?: string) => {
    const languageExtensions: { [key: string]: string } = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      csharp: 'cs',
      go: 'go',
      rust: 'rs',
      php: 'php',
      ruby: 'rb',
      swift: 'swift',
      kotlin: 'kt'
    };
    
    const extension = languageExtensions[language] || 'txt';
    const fileName = filename || `generated_code_${Date.now()}.${extension}`;
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 히스토리에서 불러오기
  const loadFromHistory = (historyItem: typeof codeHistory[0]) => {
    setRequest(historyItem.request);
    setLanguage(historyItem.language);
    // 기존 생성된 코드도 표시
    setGeneratedCode({
      code: historyItem.code,
      explanation: '히스토리에서 불러온 코드입니다.',
      usage: '자세한 설명을 보려면 다시 생성해주세요.',
      improvements: [],
      relatedConcepts: []
    });
  };

  // 템플릿 사용하기
  const applyTemplate = useCallback((template: typeof quickTemplates[0]) => {
    setRequest(template.example);
    setLanguage(template.language);
    setCodeType(template.type);
    setComplexity('simple');
  }, []);

  // 템플릿 클릭 핸들러
  const handleTemplateClick = (template: typeof quickTemplates[0]) => {
    applyTemplate(template);
  };

  // 전문가 모드 전환 시 복잡도 조정
  const handleExpertModeChange = (isExpert: boolean) => {
    setExpertMode(isExpert);
    if (isExpert) {
      setComplexity('intermediate'); // 전문가 모드에서는 중급으로 기본 설정
      setShowAdvanced(false); // 고급 설정 토글 닫기
    } else {
      setComplexity('simple'); // 초보자 모드에서는 쉬운 버전으로
    }
  };

  return (
    <>
      <Header />
      <div className="flex min-h-screen bg-gray-50">
        {/* 사이드바 */}
        <div className="w-64 bg-white shadow-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">메뉴</h2>
            <nav>
              {sideMenus.map((menu, index) => (
                <a
                  key={index}
                  href={menu.href}
                  className="flex items-center py-2 px-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors mb-1"
                >
                  {menu.icon}
                  {menu.name}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {/* 헤더 */}
            <div className="mb-8">
              <button
                onClick={() => router.push('/productivity')}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mb-4"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                생산성 도구로 돌아가기
              </button>
              
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="bg-green-500 p-2 rounded-xl">
                    <Code className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">AI 코드 생성</h1>
                    <p className="text-gray-700 mt-1">원하는 기능을 설명하면 AI가 최적화된 코드를 생성해드립니다</p>
                  </div>
                </div>
                
                {/* 모드 전환 */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleExpertModeChange(false)}
                    className={`px-4 py-2 rounded-lg transition-all ${
                      !expertMode 
                        ? 'bg-green-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    🟢 초보자 모드
                  </button>
                  <button
                    onClick={() => handleExpertModeChange(true)}
                    className={`px-4 py-2 rounded-lg transition-all ${
                      expertMode 
                        ? 'bg-purple-500 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    🔥 전문가 모드
                  </button>
                </div>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 입력 패널 */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Zap className={`w-6 h-6 ${expertMode ? 'text-purple-500' : 'text-green-500'}`} />
                    {expertMode ? '🔥 전문가용 코드 생성' : '어떤 코드가 필요하신가요?'}
                  </h2>
                  
                  {expertMode && (
                    <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-purple-800 text-sm">
                        💼 <strong>전문가 모드</strong>: 고급 요구사항, 아키텍처 패턴, 성능 최적화, 보안 고려사항 등을 포함한 프로덕션 수준의 코드를 생성합니다.
                      </p>
                    </div>
                  )}

                  {/* 초보자 모드: 빠른 시작 템플릿 */}
                  {!expertMode && (
                    <div className="mb-8">
                      <h3 className="text-lg font-medium text-gray-800 mb-4">
                        🚀 빠른 시작 (클릭하면 자동으로 입력됩니다)
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {quickTemplates.map((template, index) => (
                          <div
                            key={index}
                            onClick={() => handleTemplateClick(template)}
                            className="p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 cursor-pointer transition-all"
                          >
                            <h4 className="font-medium text-gray-900 mb-2">{template.title}</h4>
                            <p className="text-sm text-gray-600">{template.example}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 요청사항 입력 */}
                  <div className="mb-6">
                    <label className="block text-lg font-medium text-gray-800 mb-3">
                      {expertMode ? '🔥 상세한 요구사항을 입력하세요 *' : '💬 또는 직접 설명해주세요 *'}
                    </label>
                    <textarea
                      value={request}
                      onChange={(e) => setRequest(e.target.value)}
                      placeholder={expertMode 
                        ? "예: RESTful API를 사용한 사용자 인증 시스템을 구현해주세요. JWT 토큰 기반 인증, 비밀번호 해싱(bcrypt), 입력 유효성 검사, 에러 핸들링을 포함해주세요."
                        : "예: 학생 성적을 관리하는 프로그램을 만들어주세요"
                      }
                      rows={expertMode ? 6 : 4}
                      className={`w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${
                        expertMode ? 'focus:ring-purple-500 focus:border-purple-500' : 'focus:ring-green-500 focus:border-green-500'
                      } placeholder:text-gray-500 text-black ${expertMode ? 'text-base' : 'text-lg'}`}
                    />
                    <p className="text-sm text-gray-600 mt-2">
                      {expertMode 
                        ? '🔥 전문가 모드: 아키텍처, 패턴, 라이브러리, 성능 요구사항 등을 상세히 명시해주세요'
                        : '💡 팁: 구체적으로 설명할수록 더 정확한 코드를 만들어드려요!'
                      }
                    </p>
                  </div>

                  {/* 설정 섹션 */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">
                      {expertMode ? '🔧 전문가 설정' : '⚙️ 기본 설정'}
                    </h3>
                    
                    {expertMode ? (
                      // 전문가 모드: 전체 설정
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* 프로그래밍 언어 - 전체 */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              🔤 프로그래밍 언어
                            </label>
                            <select
                              value={language}
                              onChange={(e) => setLanguage(e.target.value)}
                              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                            >
                              {programmingLanguages.map((lang) => (
                                <option key={lang.value} value={lang.value}>
                                  {lang.icon} {lang.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 코드 유형 */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              📋 코드 유형
                            </label>
                            <select
                              value={codeType}
                              onChange={(e) => setCodeType(e.target.value)}
                              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                            >
                              {codeTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 복잡도 */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              🎯 구현 수준
                            </label>
                            <select
                              value={complexity}
                              onChange={(e) => setComplexity(e.target.value)}
                              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                            >
                              <option value="simple">기본 구현</option>
                              <option value="intermediate">중급 구현 (권장)</option>
                              <option value="advanced">고급 구현</option>
                            </select>
                          </div>
                        </div>

                        {/* 추가 요구사항 - 전문가용 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            🔧 세부 요구사항
                          </label>
                          <textarea
                            value={requirements}
                            onChange={(e) => setRequirements(e.target.value)}
                            placeholder="예: TypeScript 타입 정의, 단위 테스트, 에러 처리, 성능 최적화, 특정 라이브러리(React, Express 등), 디자인 패턴 적용, 주석 상세화"
                            rows={4}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500 text-black"
                          />
                        </div>
                      </div>
                    ) : (
                      // 초보자 모드: 간단한 설정
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 프로그래밍 언어 - 간소화 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            🔤 프로그래밍 언어
                          </label>
                          <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                          >
                            <option value="javascript">🟨 JavaScript (웹 프로그래밍)</option>
                            <option value="python">🐍 Python (초보자 추천)</option>
                            <option value="java">☕ Java (안드로이드, 웹)</option>
                            <option value="cpp">⚡ C++ (게임, 시스템)</option>
                          </select>
                        </div>

                        {/* 난이도 선택 - 더 직관적 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            📊 난이도
                          </label>
                          <select
                            value={complexity}
                            onChange={(e) => setComplexity(e.target.value)}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                          >
                            <option value="simple">🟢 쉬운 버전 (처음 배우는 분께 추천)</option>
                            <option value="intermediate">🟡 일반 버전 (실무 수준)</option>
                            <option value="advanced">🔴 고급 버전 (전문가 수준)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 초보자 모드: 고급 설정 토글 */}
                  {!expertMode && (
                    <>
                      <div className="mb-6">
                        <button
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm"
                        >
                          <span>🔧 {showAdvanced ? '간단하게 보기' : '더 자세한 설정'}</span>
                          <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
                            ⬇️
                          </span>
                        </button>
                      </div>

                      {/* 고급 설정 (토글) */}
                      {showAdvanced && (
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                          <h4 className="text-md font-medium text-gray-800 mb-4">🔧 고급 설정</h4>
                          
                          {/* 코드 유형 */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              코드 유형
                            </label>
                            <select
                              value={codeType}
                              onChange={(e) => setCodeType(e.target.value)}
                              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-black"
                            >
                              {codeTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 추가 요구사항 */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              추가 요구사항 (선택사항)
                            </label>
                            <textarea
                              value={requirements}
                              onChange={(e) => setRequirements(e.target.value)}
                              placeholder="예: 주석을 많이 달아주세요, 초보자가 이해하기 쉽게 만들어주세요"
                              rows={3}
                              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500 text-black"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* 생성 버튼 */}
                  <div className="text-center">
                    <button
                      onClick={generateCode}
                      disabled={loading || !request.trim()}
                      className={`w-full bg-gradient-to-r ${
                        expertMode 
                          ? 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700' 
                          : 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
                      } text-white py-5 rounded-xl transition-all font-bold text-xl disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg`}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-7 h-7 animate-spin" />
                          {expertMode 
                            ? '🔥 전문가급 코드를 생성하고 있습니다...' 
                            : '✨ AI가 열심히 코드를 만들고 있어요...'
                          }
                        </>
                      ) : (
                        <>
                          <Brain className="w-7 h-7" />
                          {expertMode 
                            ? '🚀 전문가 수준 코드 생성하기' 
                            : '🎯 AI에게 코드 만들어달라고 하기!'
                          }
                        </>
                      )}
                    </button>
                    <p className="text-sm text-gray-600 mt-3">
                      {!request.trim() 
                        ? (expertMode ? '💼 상세한 요구사항을 먼저 입력해주세요!' : '👆 위에서 무엇을 만들지 먼저 설명해주세요!') 
                        : (expertMode ? '💯 전문가 수준 코드 생성 준비 완료!' : '🚀 준비완료! 버튼을 눌러보세요!')
                      }
                    </p>
                  </div>
                </div>

                {/* 생성된 코드 결과 */}
                {generatedCode && (
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        🎉 완성된 코드가 나왔어요!
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyCode(generatedCode.code)}
                          className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          복사
                        </button>
                        <button
                          onClick={() => downloadCode(generatedCode.code)}
                          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          다운로드
                        </button>
                      </div>
                    </div>

                    {/* 코드 블록 */}
                    <div className="bg-gray-900 rounded-lg overflow-hidden mb-6">
                      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                        <span className="text-gray-300 text-sm font-mono">
                          {programmingLanguages.find(l => l.value === language)?.icon} {language}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {generatedCode.code.split('\n').length} lines
                        </span>
                      </div>
                      <pre className="p-4 text-green-400 font-mono text-sm overflow-x-auto">
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
                      <div className="mt-6 bg-yellow-50 rounded-lg p-4">
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
                      <div className="mt-6 bg-green-50 rounded-lg p-4">
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
                )}
              </div>

              {/* 히스토리 패널 */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    📚 내가 만든 코드들
                  </h3>

                  {codeHistory.length === 0 ? (
                    <div className="text-center py-6">
                      <Code className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        아직 만든 코드가 없어요!<br />
                        🎯 첫 번째 코드를 만들어보세요!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {codeHistory.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => loadFromHistory(item)}
                          className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {programmingLanguages.find(l => l.value === item.language)?.icon} {item.language}
                            </span>
                            <span className="text-xs text-gray-500">
                              {item.timestamp.toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 line-clamp-2">
                            {item.request}
                          </p>
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
    </>
  );
} 