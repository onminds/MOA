"use client";
<<<<<<< HEAD
import React, { useState } from "react";
import Header from '../../components/Header';
import {
  ArrowLeft, BookOpen, Download, Copy, Loader2, Link, HelpCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
=======
import { useState } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, LogIn,
  ArrowLeft, Search as SearchIcon, BookOpen, Download, Copy, Loader2, Link, HelpCircle, Camera, Image as ImageIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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

interface ImageData {
  id: string;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
  downloadUrl: string;
  source?: string;
}
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

export default function BlogWriter() {
  const router = useRouter();
  const [contentType, setContentType] = useState<'review' | 'info' | 'daily'>('review');
  const [postTopic, setPostTopic] = useState('');
<<<<<<< HEAD
  const [blogContent, setBlogContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
=======
  const [tone, setTone] = useState<'haeyo' | 'seupnida' | 'banmal'>('haeyo');
  const [toneExample, setToneExample] = useState('');
  const [useSearchResults, setUseSearchResults] = useState(true);
  const [useExampleImage, setUseExampleImage] = useState(true);
  const [keyContent, setKeyContent] = useState('');
  const [blogContent, setBlogContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
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
        body: JSON.stringify({
          topic: inputTopic.trim(),
          contentType,
          type: 'blog'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestedTopics(data.suggestions || []);
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
    setPostTopic(selectedTopic);
    setShowSuggestions(false);
  };

  // 주제 입력 변경 처리
  const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPostTopic(value);
    setShowSuggestions(false);
  };

  // 주제 입력 완료 시 추천 생성
  const handleTopicBlur = () => {
    if (postTopic.trim()) {
      generateSuggestedTopics(postTopic);
    }
  };

  // 이미지 크롤링
  const handleCrawlImages = async () => {
    if (!postTopic.trim()) {
      setError('게시물 주제를 입력해주세요.');
      return;
    }

    setLoadingImages(true);
    setError(null);
    
    try {
      const response = await fetch('/api/image-crawler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: postTopic.trim(),
          contentType,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '이미지 크롤링에 실패했습니다.');
      }
      
      if (data.images && data.images.length > 0) {
        setImages(data.images);
        setSelectedImages([]);
      } else {
        throw new Error('이미지를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('이미지 크롤링 오류:', error);
      setError(error instanceof Error ? error.message : '이미지 크롤링 중 오류가 발생했습니다.');
    } finally {
      setLoadingImages(false);
    }
  };

  // 이미지 선택/해제
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      if (prev.includes(imageId)) {
        // 이미 선택된 이미지라면 해제
        return prev.filter(id => id !== imageId);
      } else {
        // 선택되지 않은 이미지라면 최대 6개까지만 선택 가능
        if (prev.length >= 6) {
          return prev; // 최대 6개를 초과하면 선택하지 않음
        }
        return [...prev, imageId];
      }
    });
  };
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

  const handleGenerateBlog = async () => {
    if (!postTopic.trim()) {
      setError('게시물 주제를 입력해주세요.');
      return;
    }

<<<<<<< HEAD
=======
    if (!toneExample.trim()) {
      setError('말투 예시 문장을 입력해주세요.');
      return;
    }

>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
    setLoading(true);
    setError(null);
    
    try {
<<<<<<< HEAD
=======
      // 이미지가 선택되지 않았고 예시 이미지가 활성화되어 있다면 자동으로 이미지 크롤링
      let autoImages: ImageData[] = [];
      if (useExampleImage && selectedImages.length === 0 && images.length === 0) {
        try {
          const imageResponse = await fetch('/api/image-crawler', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              topic: postTopic.trim(),
              contentType,
            }),
          });

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            if (imageData.images && imageData.images.length > 0) {
              autoImages = imageData.images.slice(0, 6); // 최대 6개 자동 선택
              setImages(imageData.images); // 이미지 목록 업데이트
            }
          }
        } catch (error) {
          console.error('자동 이미지 크롤링 오류:', error);
        }
      }

>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      const response = await fetch('/api/blog-writer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
<<<<<<< HEAD
          topic: postTopic,
          contentType,
=======
          contentType,
          postTopic: postTopic.trim(),
          tone,
          toneExample: toneExample.trim(),
          useSearchResults,
          useExampleImage,
          keyContent: keyContent.trim(),
          selectedImages: selectedImages.length > 0 ? selectedImages : autoImages.map(img => img.id),
          autoImages: autoImages,
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '블로그 생성에 실패했습니다.');
      }
      
<<<<<<< HEAD
      if (data.content) {
        setBlogContent(data.content);
      } else {
        throw new Error('블로그 내용을 받지 못했습니다.');
=======
      if (data.blogContent) {
        setBlogContent(data.blogContent);
      } else {
        throw new Error('블로그 결과를 받지 못했습니다.');
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
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

<<<<<<< HEAD
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
=======
  const handleDownloadBlog = () => {
    if (blogContent) {
      const blob = new Blob([blogContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${postTopic.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_블로그.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleViewFullBlog = () => {
    if (blogContent) {
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        // markdown-image 키워드를 실제 이미지로 변환
        let processedContent = blogContent;
        let imageIndex = 0;
        
        if (images.length > 0) {
          processedContent = blogContent.replace(/markdown-image/g, () => {
            if (imageIndex < images.length) {
              const image = images[imageIndex];
              imageIndex++;
              return `
                <div style="margin: 20px 0; text-align: center;">
                  <img src="${image.url}" alt="${image.alt}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                  <p style="font-size: 12px; color: #666; margin-top: 8px;">이미지 출처</p>
                </div>
              `;
            }
            return '';
          });
        }

        newWindow.document.write(`
          <!DOCTYPE html>
          <html lang="ko">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${postTopic} - 블로그</title>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 1500px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8f9fa;
                font-size: 20px;
              }
              .blog-container {
                background: white;
                padding: 40px;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              .blog-title {
                font-size: 2.8em;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 20px;
                text-align: center;
              }
              .blog-content {
                font-size: 1.3em;
                line-height: 1.8;
                white-space: pre-wrap;
              }
              .blog-meta {
                text-align: center;
                color: #666;
                font-size: 0.9em;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid #eee;
              }
              .image-section {
                margin: 0;
                text-align: center;
                max-width: 60%;
                margin-left: auto;
                margin-right: auto;
              }
              .image-section img {
                max-width: 100%;
                height: auto;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                margin: 0;
              }
              .image-caption {
                font-size: 18px;
                color: #666;
                margin-top: 0;
                font-style: italic;
              }
              .image-grid {
                display: flex;
                gap: 15px;
                justify-content: center;
                flex-wrap: wrap;
                margin-top: 20px;
              }
              .image-item {
                text-align: center;
              }
              .image-item img {
                width: 400px;
                height: 300px;
                object-fit: cover;
                border-radius: 10px;
                border: 2px solid #ddd;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .image-caption {
                font-size: 12px;
                color: #666;
                margin-top: 8px;
              }
              @media (max-width: 768px) {
                body {
                  padding: 10px;
                }
                .blog-container {
                  padding: 20px;
                }
                .blog-title {
                  font-size: 2em;
                }
                .image-item img {
                  width: 300px;
                  height: 200px;
                }
              }
            </style>
          </head>
          <body>
            <div class="blog-container">
              <div class="blog-meta">
                <strong>${postTopic}</strong> | 생성일: ${new Date().toLocaleDateString('ko-KR')}
              </div>
              <div class="blog-content">${processedContent}</div>
            </div>
          </body>
          </html>
        `);
        newWindow.document.close();
      }
    }
  };

  const resetForm = () => {
    setContentType('review');
    setPostTopic('');
    setTone('haeyo');
    setToneExample('');
    setUseSearchResults(true);
    setUseExampleImage(true);
    setKeyContent('');
    setBlogContent(null);
    setError(null);
    setImages([]);
    setSelectedImages([]);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex flex-row w-full">
        {/* 왼쪽 사이드바 */}
        <aside className="w-64 bg-white/80 backdrop-blur-sm min-h-screen p-6 flex-col justify-between hidden md:flex shadow-lg">
          <nav className="space-y-2">
            {sideMenus.map((menu) => (
              <a
                key={menu.name}
                href={menu.href}
                className="flex items-center px-4 py-3 rounded-lg text-gray-800 hover:bg-gray-100 transition-all duration-200 font-medium"
              >
                {menu.icon}
                {menu.name}
              </a>
            ))}
          </nav>
          <div className="mt-8">
            <button className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-semibold shadow-lg">
              <LogIn className="w-5 h-5" /> 로그인
            </button>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {/* 헤더 */}
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => router.push('/productivity')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-all duration-200 hover:bg-gray-100 px-3 py-2 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
                뒤로가기
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  AI 블로그 작성
                </h1>
              </div>
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
                  
                  {/* 소제목 */}
                  <div className="text-center">
                    <p className="text-sm text-gray-600 font-medium">
                      {contentType === 'review' && '제품, 서비스, 장소에 대한 개인적인 경험과 평가'}
                      {contentType === 'info' && '유용한 정보와 팁을 제공하는 가이드형 콘텐츠'}
                      {contentType === 'daily' && '일상의 소소한 이야기와 개인적인 경험담'}
                    </p>
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
                  
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="게시물 주제를 입력해 주세요"
                      value={postTopic}
                      onChange={handleTopicChange}
                      onBlur={handleTopicBlur}
                      onFocus={() => setShowSuggestions(false)}
                      maxLength={30}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                      disabled={loading}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {postTopic.length}/30
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg mt-3">
                    💡 <strong>팁:</strong> 구체적인 주제를 입력하면 더 정확한 블로그를 받을 수 있습니다.
                  </div>

                  {/* AI 추천 주제 */}
                  {showSuggestions && (
                    <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-200">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-full"></div>
                        <h3 className="text-sm font-semibold text-gray-800">AI가 추천하는 블로그 주제</h3>
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

                {/* 말투 선택 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">말투</h2>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setTone('haeyo')}
                      className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                        tone === 'haeyo'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 border-2 border-blue-400'
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-2 border-gray-200 hover:from-gray-100 hover:to-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      ~해요
                    </button>
                    <button
                      onClick={() => setTone('seupnida')}
                      className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                        tone === 'seupnida'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 border-2 border-blue-400'
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-2 border-gray-200 hover:from-gray-100 hover:to-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      ~습니다
                    </button>
                    <button
                      onClick={() => setTone('banmal')}
                      className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                        tone === 'banmal'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200 border-2 border-blue-400'
                          : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-2 border-gray-200 hover:from-gray-100 hover:to-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      반말
                    </button>
                  </div>
                </div>

                {/* 말투 예시 문장 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">말투 예시 문장</h2>
                    <span className="text-sm text-red-500 font-medium">(필수)</span>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        <div className="text-center">
                          <div className="font-semibold mb-1">말투 예시 문장이란?</div>
                          <div className="text-gray-200 leading-relaxed">
                            블로그에서 사용하고 싶은 말투의 예시를 입력해주세요.<br/>
                            예: &quot;정말 맛있었어요!&quot;, &quot;이 제품은 추천합니다&quot;, &quot;꼭 한번 가보세요&quot;<br/>
                            AI가 이 예시를 참고하여 일관된 말투로 블로그를 작성해요.
                          </div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      placeholder="내 말투가 잘 표현된 문장을 입력해 주세요"
                      value={toneExample}
                      onChange={(e) => setToneExample(e.target.value)}
                      maxLength={500}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 resize-none"
                      rows={4}
                      disabled={loading}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {toneExample.length}/500
                    </div>
                  </div>
                </div>

                {/* 인터넷 검색 결과 활용 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">인터넷 검색 결과 활용하기</h2>
                      <p className="text-sm text-gray-600">주제와 관련된 검색 내용을 반영해요</p>
                    </div>
                    <button
                      onClick={() => setUseSearchResults(!useSearchResults)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useSearchResults ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          useSearchResults ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      <SearchIcon className="absolute right-1 w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>

                {/* 예시 이미지 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">예시 이미지</h2>
                      <p className="text-sm text-gray-600">이미지가 없으면 인터넷에서 찾아 배치해요</p>
                    </div>
                    <button
                      onClick={() => setUseExampleImage(!useExampleImage)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useExampleImage ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          useExampleImage ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      <Camera className="absolute right-1 w-3 h-3 text-white" />
                    </button>
                  </div>

                  {/* 이미지 크롤링 버튼 */}
                  {useExampleImage && (
                    <div className="mt-4">
                      <button
                        onClick={handleCrawlImages}
                        disabled={!postTopic.trim() || loadingImages}
                        className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {loadingImages ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            이미지 검색 중...
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-4 h-4" />
                            관련 이미지 찾기
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* 이미지 결과 */}
                  {images.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-700">추천 이미지 (클릭하여 선택)</h3>
                        <span className="text-xs text-gray-500">최대 6개 선택 가능</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                        {images.slice(0, 10).map((image) => (
                          <div
                            key={image.id}
                            onClick={() => toggleImageSelection(image.id)}
                            className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                              selectedImages.includes(image.id)
                                ? 'border-blue-500 ring-2 ring-blue-200'
                                : selectedImages.length >= 6 && !selectedImages.includes(image.id)
                                ? 'border-gray-200 opacity-50 cursor-not-allowed'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            <Image
                              src={image.thumb}
                              alt={image.alt}
                              width={200}
                              height={150}
                              className="w-full h-24 object-cover"
                            />
                            {selectedImages.includes(image.id) && (
                              <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                            <div className="p-2 bg-white/90 backdrop-blur-sm">
                              <p className="text-xs text-gray-600 truncate">{image.alt}</p>
                              <div className="flex items-center justify-between mt-1">
                                <p className="text-xs text-gray-400">by {image.photographer}</p>
                                {image.source && (
                                  <span className={`text-xs px-1 py-0.5 rounded ${
                                    image.source === 'Google' 
                                      ? 'bg-blue-100 text-blue-600' 
                                      : image.source === 'Naver'
                                      ? 'bg-green-100 text-green-600'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {image.source}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedImages.length > 0 && (
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-blue-600">
                            {selectedImages.length}개 이미지 선택됨
                          </p>
                          {selectedImages.length >= 6 && (
                            <p className="text-xs text-orange-600 font-medium">
                              최대 선택 개수에 도달했습니다
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 핵심 내용 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">핵심 내용 (선택)</h2>
                    <HelpCircle className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-600 mb-4">꼭 포함되어야 하는 내용, 전반적인 줄거리, 요구 사항 등</p>
                  
                  <textarea
                    placeholder="게시물에 반영되어야 할 요구 사항을 입력해 주세요"
                    value={keyContent}
                    onChange={(e) => setKeyContent(e.target.value)}
                    className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 resize-none"
                    rows={4}
                    disabled={loading}
                  />
                </div>

                {/* 블로그 생성 버튼 */}
                <button
                  onClick={handleGenerateBlog}
                  disabled={!postTopic.trim() || !toneExample.trim() || loading}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
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
<<<<<<< HEAD
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
=======
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
                    <div className="text-red-800 font-medium">오류 발생</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                  </div>
                )}
              </div>
<<<<<<< HEAD
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
=======

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
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                        <div className="text-gray-600 font-medium">블로그를 생성하고 있습니다...</div>
                        <div className="text-sm text-gray-500 mt-2">AI가 입력한 정보를 바탕으로 블로그를 작성해요</div>
                      </div>
                    </div>
                  ) : blogContent ? (
                    <div className="space-y-4">
                      {/* 블로그 미리보기 */}
                      <div 
                        className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-8 border border-gray-200 max-w-7xl mx-auto cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
                        onClick={handleViewFullBlog}
                      >
                        {/* 제목 */}
                        <h3 className="text-2xl font-bold text-blue-600 mb-6 text-center">
                          {postTopic}
                        </h3>
                        
                        {/* 내용 미리보기 */}
                        <div className="text-gray-800 leading-relaxed mb-6 text-lg">
                          {(() => {
                            // markdown-image 키워드를 [이미지]로 변환하여 미리보기
                            let previewContent = blogContent.split('\n').slice(0, 3).join('\n');
                            if (images.length > 0) {
                              previewContent = previewContent.replace(/markdown-image/g, '[이미지]');
                            }
                            return previewContent + (blogContent.split('\n').length > 3 ? '...' : '');
                          })()}
                        </div>
                        
                        {/* 글자 수 표시 */}
                        <div className="text-base text-gray-500 text-center mb-6">
                          공백포함 {blogContent.replace(/\s/g, '').length}자
                        </div>
                        
                        {/* 이미지 썸네일 */}
                        {images.length > 0 && (
                          <div className="mt-6">
                            <div className="flex gap-4 overflow-x-auto pb-4 justify-center">
                              {images.slice(0, 6).map((image) => (
                                <div key={image.id} className="flex-shrink-0">
                                  <Image
                                    src={image.url}
                                    alt={image.alt}
                                    width={128}
                                    height={96}
                                    className="w-32 h-24 object-cover rounded-lg border-2 border-gray-200 shadow-md"
                                    onError={(e) => {
                                      // 이미지 로드 실패 시 기본 이미지로 대체
                                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMiAyMEMyNS4zNzIgMjAgMjAgMjUuMzcyIDIwIDMyQzIwIDM4LjYyOCAyNS4zNzIgNDQgMzIgNDRDMzguNjI4IDQ0IDQ0IDM4LjYyOCA0NCAzMkM0NCAyNS4zNzIgMzguNjI4IDIwIDMyIDIwWiIgZmlsbD0iI0QxRDVEMyIvPgo8cGF0aCBkPSJNNDggNTJIMTZDMjAuNDE4MyA1MiAyNCA0OC40MTgzIDI0IDQwVjQwQzI0IDM1LjU4MTcgMjAuNDE4MyAzMiAxNiAzMkg0OEM1Mi40MTgzIDMyIDU2IDM1LjU4MTcgNTYgNDBWNDRDNTYgNDguNDE4MyA1Mi40MTgzIDUyIDQ4IDUyWiIgZmlsbD0iI0QxRDVEMyIvPgo8L3N2Zz4K';
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                            <p className="text-sm text-gray-500 mt-3 text-center">
                              {images.length}개의 이미지가 포함됨
                            </p>
                          </div>
                        )}
                        
                        {/* 클릭 안내 */}
                        <div className="text-center mt-4">
                          <div className="inline-flex items-center gap-2 text-blue-600 text-sm font-medium">
                            <Link className="w-4 h-4" />
                            클릭하여 전체 내용 보기
                          </div>
                        </div>
                      </div>
                      
                      {/* 액션 버튼들 */}
                      <div className="flex gap-3 flex-wrap">
                        <button 
                          onClick={handleDownloadBlog}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                        >
                          <Download className="w-4 h-4" />
                          다운로드
                        </button>
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
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
              </div>
            </div>
          </div>
        </div>
      </div>
<<<<<<< HEAD
    </div>
=======
    </>
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
  );
} 