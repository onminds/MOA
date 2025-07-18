"use client";
import { useState } from "react";
import Header from '../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  Code, Copy, Download, Loader2, CheckCircle, AlertCircle, Play, FileCode,
  Zap, Brain, Lightbulb, Terminal, GitBranch, Database, Globe, Smartphone
} from 'lucide-react';

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
  { value: 'function', label: '함수/메소드', icon: <Code className="w-4 h-4" /> },
  { value: 'class', label: '클래스', icon: <FileCode className="w-4 h-4" /> },
  { value: 'api', label: 'API 엔드포인트', icon: <Globe className="w-4 h-4" /> },
  { value: 'component', label: 'UI 컴포넌트', icon: <Smartphone className="w-4 h-4" /> },
  { value: 'algorithm', label: '알고리즘', icon: <Brain className="w-4 h-4" /> },
  { value: 'database', label: 'DB 쿼리', icon: <Database className="w-4 h-4" /> },
  { value: 'script', label: '스크립트', icon: <Terminal className="w-4 h-4" /> },
  { value: 'test', label: '테스트 코드', icon: <CheckCircle className="w-4 h-4" /> }
];

const complexityLevels = [
  { value: 'simple', label: '간단한 구현', description: '기본적인 기능만 포함' },
  { value: 'intermediate', label: '중급 구현', description: '에러 처리 및 최적화 포함' },
  { value: 'advanced', label: '고급 구현', description: '확장성, 보안, 성능 최적화 포함' }
];

interface GeneratedCode {
  code: string;
  explanation: string;
  usage: string;
  improvements: string[];
  relatedConcepts: string[];
}

export default function CodeGenerate() {
  // 입력 상태
  const [request, setRequest] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [codeType, setCodeType] = useState('function');
  const [complexity, setComplexity] = useState('intermediate');
  const [requirements, setRequirements] = useState('');
  
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
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-purple-500 p-3 rounded-xl">
                  <Code className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">AI 코드 생성기</h1>
                  <p className="text-gray-700 mt-1">원하는 기능을 설명하면 AI가 최적화된 코드를 생성해드립니다</p>
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
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Zap className="w-6 h-6 text-purple-500" />
                    코드 생성 요청
                  </h2>

                  {/* 요청사항 입력 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      원하는 기능 설명 *
                    </label>
                    <textarea
                      value={request}
                      onChange={(e) => setRequest(e.target.value)}
                      placeholder="예: 사용자 로그인 함수를 만들어주세요. 이메일과 비밀번호를 받아서 JWT 토큰을 반환하는 기능입니다."
                      rows={4}
                      className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500 text-black"
                    />
                  </div>

                  {/* 설정 옵션 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* 프로그래밍 언어 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        프로그래밍 언어
                      </label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
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
                        코드 유형
                      </label>
                      <select
                        value={codeType}
                        onChange={(e) => setCodeType(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                      >
                        {codeTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 복잡도 선택 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      구현 복잡도
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {complexityLevels.map((level) => (
                        <label key={level.value} className="cursor-pointer">
                          <input
                            type="radio"
                            name="complexity"
                            value={level.value}
                            checked={complexity === level.value}
                            onChange={(e) => setComplexity(e.target.value)}
                            className="sr-only"
                          />
                          <div className={`p-4 border-2 rounded-lg transition-all ${
                            complexity === level.value
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}>
                            <div className="font-medium text-gray-900">{level.label}</div>
                            <div className="text-sm text-gray-600 mt-1">{level.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 추가 요구사항 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      추가 요구사항 (선택사항)
                    </label>
                    <textarea
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      placeholder="예: 타입스크립트 타입 정의 포함, 에러 처리 강화, 성능 최적화, 특정 라이브러리 사용 등"
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder:text-gray-500 text-black"
                    />
                  </div>

                  {/* 생성 버튼 */}
                  <button
                    onClick={generateCode}
                    disabled={loading || !request.trim()}
                    className="w-full bg-purple-500 text-white py-4 rounded-xl hover:bg-purple-600 transition-colors font-semibold text-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        AI가 코드를 생성하고 있습니다...
                      </>
                    ) : (
                      <>
                        <Brain className="w-6 h-6" />
                        AI 코드 생성하기
                      </>
                    )}
                  </button>
                </div>

                {/* 생성된 코드 결과 */}
                {generatedCode && (
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                        생성된 코드
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
                      <div className="mt-6 bg-purple-50 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-900 mb-3">관련 개념</h4>
                        <div className="flex flex-wrap gap-2">
                          {generatedCode.relatedConcepts.map((concept, idx) => (
                            <span key={idx} className="bg-purple-200 text-purple-800 px-3 py-1 rounded-full text-sm">
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileCode className="w-5 h-5" />
                    생성 히스토리
                  </h3>

                  {codeHistory.length === 0 ? (
                    <div className="text-center py-8">
                      <Code className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        아직 생성된 코드가 없습니다.<br />
                        첫 번째 코드를 생성해보세요!
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