"use client";
import React, { useState } from "react";
import Header from '../../components/Header';
import {
  ArrowLeft, BookOpen, Download, Copy, Loader2, Link, HelpCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BlogWriter() {
  const router = useRouter();
  const [contentType, setContentType] = useState<'review' | 'info' | 'daily'>('review');
  const [postTopic, setPostTopic] = useState('');
  const [blogContent, setBlogContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateBlog = async () => {
    if (!postTopic.trim()) {
      setError('게시물 주제를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/blog-writer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: postTopic,
          contentType,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '블로그 생성에 실패했습니다.');
      }
      
      if (data.content) {
        setBlogContent(data.content);
      } else {
        throw new Error('블로그 내용을 받지 못했습니다.');
      }
    } catch (error) {
      console.error('블로그 생성 오류:', error);
      setError(error instanceof Error ? error.message : '블로그 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBlog = () => {
    if (blogContent) {
      navigator.clipboard.writeText(blogContent);
    }
  };

  const resetForm = () => {
    setPostTopic('');
    setBlogContent(null);
    setError(null);
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-8">
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
            <h1 className="text-3xl font-bold text-gray-900">AI 블로그 작성</h1>
            <p className="text-gray-600 text-lg mt-2">
              주제와 스타일을 선택하면 AI가 전문적인 블로그 포스트를 작성해드립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 입력 영역 */}
            <div className="space-y-6">
              {/* 콘텐츠 타입 선택 */}
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                  스타일 설정
                </h2>
                
                <div className="flex space-x-2 mb-4">
                  <button
                    onClick={() => setContentType('review')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                      contentType === 'review'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-md'
                        : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200 hover:shadow-sm'
                    }`}
                  >
                    리뷰
                  </button>
                  <button
                    onClick={() => setContentType('info')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                      contentType === 'info'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-md'
                        : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200 hover:shadow-sm'
                    }`}
                  >
                    정보
                  </button>
                  <button
                    onClick={() => setContentType('daily')}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                      contentType === 'daily'
                        ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-md'
                        : 'bg-gray-100 text-gray-600 border-2 border-gray-200 hover:bg-gray-200 hover:shadow-sm'
                    }`}
                  >
                    일상
                  </button>
                </div>
              </div>

              {/* 게시물 주제 */}
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">게시물 주제</h2>
                  <span className="text-sm text-red-500 font-medium">(필수)</span>
                  <HelpCircle className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600 mb-4">후기, 리뷰 등의 주제를 입력해 주세요</p>
                
                <input
                  type="text"
                  placeholder="게시물 주제를 입력해 주세요"
                  value={postTopic}
                  onChange={(e) => setPostTopic(e.target.value)}
                  maxLength={30}
                  className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                  disabled={loading}
                />
                
                <button
                  onClick={handleGenerateBlog}
                  disabled={!postTopic.trim() || loading}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2 mt-6"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      블로그 생성 중...
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-5 h-5" />
                      블로그 생성
                    </>
                  )}
                </button>
                
                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-red-800 font-medium">오류 발생</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                  </div>
                )}
              </div>
            </div>

            {/* 결과 영역 */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"></div>
                블로그 결과
              </h2>
              <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 min-h-[500px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="w-16 h-16 animate-spin mx-auto mb-6 text-blue-500" />
                      <div className="text-gray-600 font-medium">블로그를 생성하고 있습니다...</div>
                      <div className="text-sm text-gray-500 mt-2">AI가 내용을 작성하고 있어요</div>
                    </div>
                  </div>
                ) : blogContent ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                      <div className="whitespace-pre-wrap text-gray-800 leading-relaxed font-medium">
                        {blogContent}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleCopyBlog}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                      >
                        <Copy className="w-4 h-4" />
                        복사
                      </button>
                      <button 
                        onClick={resetForm}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                      >
                        <BookOpen className="w-4 h-4" />
                        새로 작성
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-500">
                      <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <div className="font-medium">블로그 결과가 여기에 표시됩니다</div>
                      <div className="text-sm mt-2">주제를 입력하고 블로그 생성을 시작해주세요</div>
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