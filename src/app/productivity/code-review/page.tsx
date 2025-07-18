"use client";
import { useState } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  ArrowLeft, Code, Copy, Loader2, CheckCircle, AlertCircle, FileCode, Star,
  Zap, Brain, Shield, Bug, TrendingUp, Eye, Target, Lightbulb
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

const reviewTypes = [
  { value: 'general', label: '전체 리뷰', description: '코드 품질, 성능, 보안 등 종합 검토' },
  { value: 'security', label: '보안 검토', description: '보안 취약점 및 위험 요소 분석' },
  { value: 'performance', label: '성능 최적화', description: '성능 개선점 및 최적화 방안 제안' },
  { value: 'style', label: '코드 스타일', description: '코딩 컨벤션 및 가독성 검토' },
  { value: 'bug', label: '버그 탐지', description: '잠재적 버그 및 논리 오류 분석' }
];

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

export default function CodeReview() {
  const router = useRouter();
  
  // 입력 상태
  const [code, setCode] = useState('');
  const [reviewType, setReviewType] = useState('general');
  const [description, setDescription] = useState('');
  
  // 결과 상태
  const [reviewResult, setReviewResult] = useState<CodeReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 히스토리
  const [reviewHistory, setReviewHistory] = useState<Array<{
    id: number;
    language: string;
    reviewType: string;
    codePreview: string;
    score: number;
    timestamp: Date;
  }>>([]);

  // 코드 리뷰 실행
  const performReview = async () => {
    if (!code.trim()) {
      setError('검토할 코드를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setReviewResult(null);

    try {
      const response = await fetch('/api/code-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code.trim(),
          reviewType,
          description: description.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '코드 리뷰에 실패했습니다.');
      }

      const data = await response.json();
      
      if (data.success && data.result) {
        setReviewResult(data.result);
        
        // 히스토리에 추가
        const newHistoryItem = {
          id: Date.now(),
          language: data.result.detectedLanguage || 'unknown',
          reviewType,
          codePreview: code.trim().substring(0, 50) + (code.trim().length > 50 ? '...' : ''),
          score: data.result.overallScore,
          timestamp: new Date()
        };
        setReviewHistory(prev => [newHistoryItem, ...prev.slice(0, 9)]); // 최대 10개 유지
      } else {
        throw new Error('코드 리뷰 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('코드 리뷰 오류:', error);
      setError(error instanceof Error ? error.message : '코드 리뷰 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 코드 복사
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    // TODO: 토스트 알림 추가
  };

  // 점수에 따른 색상 반환
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // 이슈 레벨에 따른 색상 반환
  const getIssueColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  const getIssueIcon = (level: string) => {
    switch (level) {
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertCircle className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
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
              
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-500 p-2 rounded-xl">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">AI 코드 리뷰</h1>
                  <p className="text-gray-700 mt-1">AI가 코드를 분석하여 개선점과 문제점을 찾아드립니다</p>
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
                    <Zap className="w-6 h-6 text-blue-500" />
                    🔍 코드를 검사해드릴게요!
                  </h2>

                  {/* 코드 입력 */}
                  <div className="mb-6">
                    <label className="block text-lg font-medium text-gray-800 mb-3">
                      📝 검사받고 싶은 코드를 붙여넣어 주세요 *
                    </label>
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="여기에 코드를 붙여넣어 주세요... 걱정마세요, AI가 친절하게 검사해드릴게요!"
                      rows={12}
                      className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-black font-mono text-sm"
                    />
                    <p className="text-sm text-gray-600 mt-2">
                      💡 팁: 어떤 언어든 상관없어요! AI가 알아서 분석해드립니다
                    </p>
                  </div>

                                                        {/* 기본 설정 */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">⚙️ 기본 설정</h3>
                    
                    {/* 언어 자동 감지 안내 */}
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        🤖 AI가 코드를 보고 자동으로 언어를 감지해드립니다!
                      </p>
                    </div>

                    {/* 리뷰 유형 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        🔍 어떻게 검사할까요?
                      </label>
                      <select
                        value={reviewType}
                        onChange={(e) => setReviewType(e.target.value)}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      >
                        <option value="general">🌟 전체적으로 봐주세요 (추천)</option>
                        <option value="bug">🐛 버그가 있는지 찾아주세요</option>
                        <option value="style">✨ 코드가 깔끔한지 봐주세요</option>
                        <option value="performance">⚡ 더 빠르게 만들 수 있는지 봐주세요</option>
                        <option value="security">🔒 보안에 문제가 없는지 봐주세요</option>
                      </select>
                    </div>
                  </div>

                  {/* 선택된 리뷰 유형 설명 */}
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-blue-800 text-sm">
                      <strong>{reviewTypes.find(t => t.value === reviewType)?.label}:</strong>{' '}
                      {reviewTypes.find(t => t.value === reviewType)?.description}
                    </p>
                  </div>

                  {/* 추가 설명 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      코드 설명 (선택사항)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="코드의 목적이나 특별히 검토받고 싶은 부분을 설명해주세요..."
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-black"
                    />
                  </div>

                  {/* 리뷰 버튼 */}
                  <div className="text-center">
                    <button
                      onClick={performReview}
                      disabled={loading || !code.trim()}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-5 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-bold text-xl disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-7 h-7 animate-spin" />
                          🔍 AI가 꼼꼼히 검사하고 있어요...
                        </>
                      ) : (
                        <>
                          <Brain className="w-7 h-7" />
                          🚀 AI에게 코드 검사 맡기기!
                        </>
                      )}
                    </button>
                    <p className="text-sm text-gray-600 mt-3">
                      {!code.trim() ? '👆 위에서 코드를 먼저 붙여넣어주세요!' : '📋 코드 검사를 시작할 준비가 되었어요!'}
                    </p>
                  </div>
                </div>

                {/* 리뷰 결과 */}
                {reviewResult && (
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          📊 검사 결과가 나왔어요!
                        </h3>
                        {reviewResult.detectedLanguage && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm text-gray-600">🔍 감지된 언어:</span>
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                              {reviewResult.detectedLanguage}
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
                      <h4 className="font-semibold text-gray-900 mb-2">📋 요약</h4>
                      <p className="text-gray-700 leading-relaxed">{reviewResult.summary}</p>
                    </div>

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
                                  <p className="text-sm font-medium">💡 제안: {issue.suggestion}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 개선사항과 장점 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="bg-orange-50 rounded-lg p-4">
                        <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          개선사항
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {reviewResult.improvements.map((improvement, idx) => (
                            <li key={idx} className="text-orange-800 text-sm">{improvement}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                          <Star className="w-4 h-4" />
                          잘된 점
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {reviewResult.positives.map((positive, idx) => (
                            <li key={idx} className="text-green-800 text-sm">{positive}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* 주석이 달린 원본 코드 */}
                    {reviewResult.annotatedCode && (
                      <div className="bg-blue-50 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            📝 코드에 주석으로 문제점 표시
                          </h4>
                          <button
                            onClick={() => copyCode(reviewResult.annotatedCode!)}
                            className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
                          >
                            <Copy className="w-3 h-3" />
                            복사
                          </button>
                        </div>
                        <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                          <pre className="font-mono text-sm overflow-x-auto leading-relaxed">
                            <code className="text-gray-800">{reviewResult.annotatedCode}</code>
                          </pre>
                        </div>
                        <p className="text-blue-700 text-sm mt-2">
                          💡 각 줄 옆의 주석을 확인하여 개선점을 파악하세요!
                        </p>
                      </div>
                    )}

                    {/* 리팩토링된 코드 */}
                    {reviewResult.refactoredCode && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            🔧 개선된 코드 제안
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
                <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileCode className="w-4 h-4" />
                    📋 검사한 코드들
                  </h3>

                  {reviewHistory.length === 0 ? (
                    <div className="text-center py-6">
                      <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        아직 검사한 코드가 없어요!<br />
                        🔍 첫 번째 코드 검사를 시작해보세요!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {reviewHistory.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {programmingLanguages.find(l => l.value === item.language)?.icon} {item.language}
                            </span>
                            <span className={`text-sm font-bold ${getScoreColor(item.score)}`}>
                              {item.score}점
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 mb-1">
                            {reviewTypes.find(t => t.value === item.reviewType)?.label}
                          </p>
                          <p className="text-xs text-gray-600 mb-2">
                            {item.timestamp.toLocaleString()}
                          </p>
                          <code className="text-xs text-gray-700 bg-gray-100 p-1 rounded block">
                            {item.codePreview}
                          </code>
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