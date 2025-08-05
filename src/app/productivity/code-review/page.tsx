"use client";
import React, { useState } from "react";
import Header from '../../components/Header';
import {
  ArrowLeft, Eye, Copy, Loader2, FileCode, CheckCircle, Bug, AlertCircle, TrendingUp, MessageCircle
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

export default function CodeReview() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [reviewResult, setReviewResult] = useState<CodeReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const programmingLanguages = [
    { value: 'javascript', label: '🟨 JavaScript', icon: '🟨' },
    { value: 'python', label: '🐍 Python', icon: '🐍' },
    { value: 'java', label: '☕ Java', icon: '☕' },
    { value: 'cpp', label: '⚡ C++', icon: '⚡' },
  ];

  const reviewTypes = [
    { value: 'general', label: '일반 검사' },
    { value: 'security', label: '보안 검사' },
    { value: 'performance', label: '성능 검사' },
  ];

  const performReview = async () => {
    if (!code.trim()) {
      setError('코드를 입력해주세요.');
      return;
    }

    if (code.length > 10000) {
      setError('코드가 너무 깁니다. 10,000자 이하로 줄여주세요.');
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
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '코드 검사에 실패했습니다.');
      }
      
      if (data.result) {
        setReviewResult(data.result);
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
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">AI 코드 검사</h1>
            <p className="text-gray-600 text-lg mt-2">
              AI가 코드를 분석하고 개선점을 제안해드립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 입력 영역 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <FileCode className="w-6 h-6" />
                  코드 입력
                </h2>

                <div className="space-y-6">
                  {/* 코드 입력 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      💻 검사할 코드를 입력해주세요
                    </label>
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="검사하고 싶은 코드를 여기에 붙여넣어주세요..."
                      rows={12}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 placeholder:text-gray-500 text-black font-mono text-sm resize-none"
                    />
                  </div>

                  {/* 리뷰 버튼 */}
                  <div className="text-center">
                    <button
                      onClick={performReview}
                      disabled={loading || !code.trim() || code.length > 10000}
                      className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-5 rounded-xl hover:from-green-600 hover:to-green-700 transition-all font-bold text-xl disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-7 h-7 animate-spin" />
                          🔍 AI가 꼼꼼히 검사하고 있어요...
                        </>
                      ) : (
                        <>
                          <Eye className="w-7 h-7" />
                          🚀 AI에게 코드 검사 맡기기!
                        </>
                      )}
                    </button>
                    <p className="text-sm text-gray-600 mt-3">
                      {!code.trim() ? '👆 위에서 코드를 먼저 붙여넣어주세요!' : 
                       code.length > 10000 ? '⚠️ 코드가 너무 깁니다. 10,000자 이하로 줄여주세요.' :
                       '📋 코드 검사를 시작할 준비가 되었어요!'}
                    </p>
                  </div>
                </div>

                {/* 리뷰 결과 */}
                {reviewResult && (
                  <div className="bg-white rounded-2xl shadow-lg p-8 mt-8">
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
            </div>

            {/* 히스토리 패널 */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
                <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  📋 검사한 코드들
                </h3>

                <div className="text-center py-6">
                  <Eye className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">
                    아직 검사한 코드가 없어요!<br />
                    🔍 첫 번째 코드 검사를 시작해보세요!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 