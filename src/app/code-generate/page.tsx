"use client";
import { useState } from "react";
import Header from '../components/Header';
import {
  Code, Copy, Download, Loader2, CheckCircle, AlertCircle, Play, FileCode,
  Zap, Brain, Lightbulb, Terminal, GitBranch, Database, Globe, Smartphone
} from 'lucide-react';

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
      <div className="min-h-screen bg-gray-50">
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">AI 코드 생성</h1>
              <p className="text-gray-600">요구사항을 입력하면 AI가 코드를 자동으로 생성해드립니다</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 입력 영역 */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">코드 요청</h2>
                  
                  {/* 프로그래밍 언어 선택 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">프로그래밍 언어</label>
                    <div className="grid grid-cols-3 gap-2">
                      {programmingLanguages.map((lang) => (
                        <button
                          key={lang.value}
                          onClick={() => setLanguage(lang.value)}
                          className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                            language === lang.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{lang.icon}</span>
                            <span>{lang.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 코드 타입 선택 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">코드 타입</label>
                    <div className="grid grid-cols-2 gap-2">
                      {codeTypes.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setCodeType(type.value)}
                          className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                            codeType === type.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {type.icon}
                            <span>{type.label}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 복잡도 선택 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">복잡도</label>
                    <div className="space-y-2">
                      {complexityLevels.map((level) => (
                        <button
                          key={level.value}
                          onClick={() => setComplexity(level.value)}
                          className={`w-full p-3 rounded-lg border text-left transition-colors ${
                            complexity === level.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium">{level.label}</div>
                          <div className="text-xs opacity-70">{level.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 요청사항 입력 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      코드 요청사항 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={request}
                      onChange={(e) => setRequest(e.target.value)}
                      placeholder="예: 사용자 정보를 저장하는 함수를 만들어줘"
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      disabled={loading}
                    />
                  </div>

                  {/* 추가 요구사항 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      추가 요구사항 (선택)
                    </label>
                    <textarea
                      value={requirements}
                      onChange={(e) => setRequirements(e.target.value)}
                      placeholder="예: 에러 처리, 성능 최적화, 특정 라이브러리 사용 등"
                      className="w-full h-24 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      disabled={loading}
                    />
                  </div>

                  {/* 생성 버튼 */}
                  <button
                    onClick={generateCode}
                    disabled={loading || !request.trim()}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Code className="w-5 h-5" />
                        코드 생성
                      </>
                    )}
                  </button>

                  {/* 오류 메시지 */}
                  {error && (
                    <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}
                </div>

                {/* 히스토리 */}
                {codeHistory.length > 0 && (
                  <div className="mt-6 bg-white rounded-xl p-6 shadow-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">최근 생성 기록</h3>
                    <div className="space-y-3">
                      {codeHistory.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => loadFromHistory(item)}
                          className="w-full p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {item.request}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {item.language} • {item.timestamp.toLocaleDateString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 결과 영역 */}
              <div className="lg:col-span-2">
                {generatedCode ? (
                  <div className="space-y-6">
                    {/* 생성된 코드 */}
                    <div className="bg-white rounded-xl p-6 shadow-lg">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">생성된 코드</h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyCode(generatedCode.code)}
                            className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                            title="코드 복사"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => downloadCode(generatedCode.code)}
                            className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
                            title="코드 다운로드"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{generatedCode.code}</code>
                      </pre>
                    </div>

                    {/* 코드 설명 */}
                    <div className="bg-white rounded-xl p-6 shadow-lg">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">코드 설명</h3>
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-700 mb-4">{generatedCode.explanation}</p>
                        
                        {generatedCode.usage && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-900 mb-2">사용법</h4>
                            <p className="text-gray-700">{generatedCode.usage}</p>
                          </div>
                        )}

                        {generatedCode.improvements.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold text-gray-900 mb-2">개선 사항</h4>
                            <ul className="list-disc list-inside text-gray-700 space-y-1">
                              {generatedCode.improvements.map((improvement, index) => (
                                <li key={index}>{improvement}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {generatedCode.relatedConcepts.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">관련 개념</h4>
                            <div className="flex flex-wrap gap-2">
                              {generatedCode.relatedConcepts.map((concept, index) => (
                                <span
                                  key={index}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                >
                                  {concept}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-12 shadow-lg text-center">
                    <Code className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">코드를 생성해보세요</h3>
                    <p className="text-gray-600">왼쪽에서 요청사항을 입력하고 코드 생성을 시작하세요.</p>
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