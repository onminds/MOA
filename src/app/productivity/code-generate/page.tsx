"use client";
import React, { useState } from "react";
import Header from '../../components/Header';
import {
  ArrowLeft, Code, Download, Copy, Loader2, FileCode, Play, Lightbulb, GitBranch
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GeneratedCode {
  code: string;
  explanation: string;
  usage: string;
  improvements: string[];
  relatedConcepts: string[];
}

export default function CodeGenerate() {
  const router = useRouter();
  const [language, setLanguage] = useState('javascript');
  const [request, setRequest] = useState('');
  const [complexity, setComplexity] = useState('intermediate');
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const programmingLanguages = [
    { value: 'javascript', label: '🟨 JavaScript', icon: '🟨' },
    { value: 'python', label: '🐍 Python', icon: '🐍' },
    { value: 'java', label: '☕ Java', icon: '☕' },
    { value: 'cpp', label: '⚡ C++', icon: '⚡' },
  ];

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
      
      if (data.code) {
        setGeneratedCode(data);
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
            <h1 className="text-3xl font-bold text-gray-900">AI 코드 생성</h1>
            <p className="text-gray-600 text-lg mt-2">
              자연어로 설명하면 AI가 코드를 생성해드립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 입력 영역 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <FileCode className="w-6 h-6" />
                  코드 요청사항
                </h2>

                <div className="space-y-6">
                  {/* 프로그래밍 언어 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🔤 프로그래밍 언어
                    </label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      {programmingLanguages.map((lang) => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 난이도 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📊 난이도
                    </label>
                    <select
                      value={complexity}
                      onChange={(e) => setComplexity(e.target.value)}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      <option value="simple">🟢 쉬운 버전</option>
                      <option value="intermediate">🟡 일반 버전</option>
                      <option value="advanced">🔴 고급 버전</option>
                    </select>
                  </div>

                  {/* 코드 요청사항 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      💡 원하는 코드를 설명해주세요
                    </label>
                    <textarea
                      value={request}
                      onChange={(e) => setRequest(e.target.value)}
                      placeholder="예: 사용자 입력을 받아서 숫자를 더하는 함수를 만들어줘"
                      rows={6}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-black resize-none"
                    />
                  </div>

                  {/* 생성 버튼 */}
                  <div className="text-center">
                    <button
                      onClick={generateCode}
                      disabled={loading || !request.trim()}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-5 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-bold text-xl disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-7 h-7 animate-spin" />
                          🔍 AI가 코드를 생성하고 있어요...
                        </>
                      ) : (
                        <>
                          <Code className="w-7 h-7" />
                          🚀 코드 생성하기!
                        </>
                      )}
                    </button>
                    <p className="text-sm text-gray-600 mt-3">
                      {!request.trim() ? '👆 위에서 원하는 코드를 설명해주세요!' : '📋 코드 생성을 시작할 준비가 되었어요!'}
                    </p>
                  </div>

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-red-800 font-medium">오류 발생</div>
                      <div className="text-red-600 text-sm mt-1">{error}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* 결과 영역 */}
              {generatedCode && (
                <div className="bg-white rounded-2xl shadow-lg p-8">
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
              <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
                <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  📚 내가 만든 코드들
                </h3>

                <div className="text-center py-6">
                  <Code className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">
                    아직 만든 코드가 없어요!<br />
                    🎯 첫 번째 코드를 만들어보세요!
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