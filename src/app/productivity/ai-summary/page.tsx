"use client";
import React, { useState, useEffect } from "react";
import { useSession } from 'next-auth/react';
import Header from '../../components/Header';
import {
  ArrowLeft, Youtube, FileText, Globe, Type, Upload, Download, Copy, X, Send
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import TextLoadingAnimation from '@/components/TextLoadingAnimation';

export default function AISummary() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [inputContent, setInputContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [inputType, setInputType] = useState<'auto' | 'youtube' | 'document' | 'website' | 'text'>('auto');
  const [showSpeechBubble, setShowSpeechBubble] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [youtubeInfo, setYoutubeInfo] = useState<{title: string, url: string} | null>(null);
  const [websiteInfo, setWebsiteInfo] = useState<{title: string, url: string, favicon: string} | null>(null);
  const [showInput, setShowInput] = useState(true);
  const [youtubeVideoInfo, setYoutubeVideoInfo] = useState<{title: string, thumbnail: string, duration: string, channel: string, url: string} | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (status === 'unauthenticated') {
      setIsLoginModalOpen(true);
    }
  }, [status]);

  // 입력 내용 분석하여 타입 자동 감지
  useEffect(() => {
    const content = inputContent.trim();
    if (!content) {
      setInputType('auto');
      return;
    }

    // YouTube URL 감지
    if (content.includes('youtube.com') || content.includes('youtu.be')) {
      setInputType('youtube');
    }
    // 웹사이트 URL 감지
    else if (content.startsWith('http://') || content.startsWith('https://')) {
      setInputType('website');
    }
    // 텍스트로 간주
    else {
      setInputType('text');
    }
  }, [inputContent]);

  const handleFileUpload = (file: File) => {
    // HWP 파일 검증
    if (file.name.toLowerCase().endsWith('.hwp')) {
      setError('한글 문서(.hwp)는 현재 지원되지 않습니다. Microsoft Word(.docx), 구형 Word(.doc), 또는 텍스트 파일(.txt)로 변환 후 업로드해주세요.');
      return;
    }
    
    setUploadedFile(file);
    setInputType('document');
    setError(null); // 이전 오류 메시지 제거
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  };

  const extractYoutubeInfo = async (url: string) => {
    try {
      const videoId = extractVideoId(url);
      if (!videoId) return;

      const response = await fetch(`/api/youtube-info?videoId=${videoId}`);
      
      if (response.ok) {
        const data = await response.json();
        setYoutubeInfo({ title: data.title, url });
        setYoutubeVideoInfo({
          title: data.title,
          thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          duration: data.duration || '',
          channel: data.channel || '',
          url: url
        });
      } else {
        const errorData = await response.json();
        console.error('API 오류:', errorData);
      }
    } catch (error) {
      console.error('YouTube 정보 가져오기 실패:', error);
    }
  };

  const extractWebsiteInfo = async (url: string) => {
    try {
      const response = await fetch(`/api/website-info?url=${encodeURIComponent(url)}`);
      
      if (response.ok) {
        const data = await response.json();
        setWebsiteInfo({ title: data.title, url, favicon: data.favicon });
      } else {
        const errorData = await response.json();
        console.error('API 오류:', errorData);
      }
    } catch (error) {
      console.error('웹사이트 정보 가져오기 실패:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputContent(value);
    
    // YouTube URL 감지
    if (value.includes('youtube.com') || value.includes('youtu.be')) {
      const videoId = extractVideoId(value);
      setYoutubeInfo({ title: 'YouTube 영상', url: value });
      setWebsiteInfo(null);
      if (videoId) {
        setYoutubeVideoInfo({
          title: 'YouTube 영상',
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          duration: '10:30',
          channel: 'YouTube',
          url: value
        });
      }
      extractYoutubeInfo(value);
    }
    // 웹사이트 URL 감지 (YouTube가 아닌 http/https URL)
    else if ((value.startsWith('http://') || value.startsWith('https://')) && 
             !value.includes('youtube.com') && !value.includes('youtu.be')) {
      setWebsiteInfo({ title: '', url: value, favicon: '' });
      setYoutubeInfo(null);
      setYoutubeVideoInfo(null);
      extractWebsiteInfo(value);
    } else {
      setYoutubeInfo(null);
      setWebsiteInfo(null);
      setYoutubeVideoInfo(null);
    }
  };

  const handleGenerateSummary = async () => {
    if (!session) {
      setIsLoginModalOpen(true);
      return;
    }

    if (!inputContent.trim() && !uploadedFile) {
      setError('내용을 입력하거나 파일을 업로드해주세요.');
      return;
    }

    setLoading(true);
    setSummary(null);
    setError(null);
    setShowInput(false);
    
    try {
      const formData = new FormData();
      
      if (uploadedFile) {
        formData.append('type', 'document');
        formData.append('document', uploadedFile);
      } else {
        let type = 'text';
        if (inputType === 'youtube') type = 'youtube';
        else if (inputType === 'website') type = 'website';
        
        formData.append('type', type);
        
        if (type === 'youtube') {
          formData.append('youtubeUrl', inputContent);
        } else if (type === 'website') {
          formData.append('websiteUrl', inputContent);
        } else {
          formData.append('textContent', inputContent);
        }
      }

      const response = await fetch('/api/ai-summary', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '요약 생성에 실패했습니다.');
      }
      
      if (data.summary) {
        setSummary(data.summary);
      } else {
        throw new Error('요약 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('요약 생성 오류:', error);
      // 오류 발생 시 메인 페이지로 돌아가기
      setShowInput(true);
      setError(error instanceof Error ? error.message : '요약 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const canGenerate = () => {
    return (inputContent.trim() !== '' || uploadedFile !== null) && !loading;
  };

  const showToastMessage = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleCopySummary = async () => {
    if (summary) {
      try {
        await navigator.clipboard.writeText(summary);
        showToastMessage('요약 내용이 클립보드에 복사되었습니다!', 'success');
      } catch (error) {
        console.error('복사 실패:', error);
        // 대안 방법: 텍스트 영역을 생성하여 복사
        const textArea = document.createElement('textarea');
        textArea.value = summary;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          showToastMessage('요약 내용이 클립보드에 복사되었습니다!', 'success');
        } catch (fallbackError) {
          console.error('대안 복사 방법도 실패:', fallbackError);
          showToastMessage('복사에 실패했습니다. 수동으로 복사해주세요.', 'error');
        }
        document.body.removeChild(textArea);
      }
    }
  };

  const handleNewSummary = () => {
    setSummary(null);
    setInputContent('');
    setUploadedFile(null);
    setYoutubeInfo(null);
    setWebsiteInfo(null);
    setYoutubeVideoInfo(null);
    setShowVideoPlayer(false);
    setShowInput(true);
    setError(null);
    setShowSpeechBubble(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerateSummary();
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-8">
        <div className="max-w-6xl mx-auto">
          {/* 뒤로가기 버튼 */}
          <div className="mb-12">
            <button
              onClick={() => router.push('/productivity')}
              className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              생산성 도구로 돌아가기
            </button>
          </div>

          {/* 결과 영역 */}
          <div className="mb-16">
            <div className="min-h-[500px]">
              {loading ? (
                <TextLoadingAnimation 
                  message="요약을 생성하고 있습니다..." 
                  subMessage="AI가 내용을 분석하고 있어요"
                />
              ) : summary ? (
                <div className="space-y-4 flex flex-col items-center">
                  {/* 요약 결과 제목 */}
                  <div className={`${youtubeVideoInfo ? 'mb-1' : 'mb-3'} text-center`}>
                    <h2 className="text-3xl font-bold text-gray-900">요약 결과</h2>
                  </div>
                  
                  {/* YouTube 영상 정보 표시 */}
                  {youtubeVideoInfo && (
                    <div className="flex justify-center mb-3">
                      {showVideoPlayer ? (
                        <div className="relative">
                          <iframe
                            width="800"
                            height="450"
                            src={`https://www.youtube.com/embed/${extractVideoId(youtubeVideoInfo.url)}?autoplay=1`}
                            title={youtubeVideoInfo.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="rounded-lg shadow-xl"
                          ></iframe>
                          <button
                            onClick={() => setShowVideoPlayer(false)}
                            className="absolute top-2 right-2 w-8 h-8 bg-black bg-opacity-70 text-white rounded-full flex items-center justify-center hover:bg-opacity-90 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative cursor-pointer bg-gray-100 rounded-lg p-4" onClick={() => setShowVideoPlayer(true)}>
                          <img 
                            src={youtubeVideoInfo.thumbnail} 
                            alt={youtubeVideoInfo.title}
                            className="w-[600px] h-[338px] rounded-lg object-cover shadow-xl hover:shadow-2xl transition-shadow"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = `https://img.youtube.com/vi/${extractVideoId(youtubeVideoInfo.url)}/hqdefault.jpg`;
                            }}
                          />
                          <div className="absolute bottom-3 right-3 bg-black bg-opacity-80 text-white text-sm px-3 py-1 rounded">
                            {youtubeVideoInfo.duration || '10:30'}
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center">
                              <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 요약 결과 */}
                  {summary && (
                    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200 max-w-4xl w-full">
                      <div className="prose max-w-none">
                        <ReactMarkdown 
                          components={{
                            h1: ({children}) => <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-6 first:mt-0">{children}</h1>,
                            h2: ({children}) => <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-5">{children}</h2>,
                            h3: ({children}) => <h3 className="text-lg font-medium text-gray-700 mb-2 mt-4">{children}</h3>,
                            p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
                            ul: ({children}) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                            li: ({children}) => <li className="text-gray-700">{children}</li>,
                            strong: ({children}) => <strong className="font-semibold text-gray-900">{children}</strong>,
                            em: ({children}) => <em className="italic text-gray-600">{children}</em>
                          }}
                        >
                          {summary}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full pt-40">
                  <div className="text-center">
                    <h1 className="text-5xl font-bold text-gray-900 mb-6">AI 완벽요약</h1>
                    <p className="text-xl text-gray-600 mb-12">
                      다양한 형태의 콘텐츠를 AI가 핵심만 추출하여 요약해드립니다.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 통합 입력창 (하단) */}
          {showInput && (
            <div className="mt-8">
              {/* 작은 아이콘들 */}
              <div className="h-16 mb-6" style={{
                transform: youtubeInfo || uploadedFile || websiteInfo ? 'translateY(-32px)' : 'translateY(0)',
                marginBottom: youtubeInfo || uploadedFile || websiteInfo ? '1px' : '0'
              }}>
                {showSpeechBubble && (
                  <div className="relative">
                    <div className="bg-white rounded-2xl px-4 py-3 flex justify-start items-center gap-3 shadow-lg border border-gray-200 ml-4 max-w-xl relative">
                      <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                        <Youtube className="w-5 h-5 text-white" />
                      </div>
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                        <Globe className="w-5 h-5 text-white" />
                      </div>
                      <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                        <Type className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm text-gray-700 font-medium ml-2">AI 완벽요약은 URL, 문서, 텍스트를 지원합니다</span>
                      <button 
                        onClick={() => setShowSpeechBubble(false)}
                        className="absolute top-2 right-2 w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {/* 말풍선 꼬리 */}
                    <div className="absolute bottom-0 left-8 transform translate-y-full">
                      <div className="w-3 h-3 bg-white border-l border-b border-gray-200 transform rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>

              {/* 단순한 입력창 */}
              <div className="relative">
                <div className={`relative w-full border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white/80 backdrop-blur-sm shadow-lg transition-all overflow-hidden ${
                  youtubeInfo || uploadedFile || websiteInfo ? 'h-40' : 'h-32'
                } ${isDragOver ? 'border-blue-500 bg-blue-50/50' : ''}`} style={{
                  transform: youtubeInfo || uploadedFile || websiteInfo ? 'translateY(-32px)' : 'translateY(0)',
                  marginBottom: youtubeInfo || uploadedFile || websiteInfo ? '32px' : '0'
                }}>
                  {/* 입력 타입 아이콘 표시 */}
                  {(youtubeInfo || uploadedFile || websiteInfo) && (
                    <div className="absolute top-0 left-0 right-0 p-4 pb-2">
                      <div className="flex items-center gap-3">
                        {youtubeInfo && (
                          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
                            <div className="w-8 h-6 bg-red-500 rounded flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                            <span className="text-sm font-medium text-gray-700">YouTube</span>
                          </div>
                        )}
                        {uploadedFile && (
                          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
                            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
                              <FileText className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 truncate max-w-32">{uploadedFile.name}</span>
                            <button
                              onClick={() => setUploadedFile(null)}
                              className="text-gray-400 hover:text-gray-600 transition-colors ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {websiteInfo && (
                          <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
                            <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center">
                              <Globe className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-sm font-medium text-gray-700 truncate max-w-32">{websiteInfo.title || '웹사이트'}</span>
                            <button
                              onClick={() => setWebsiteInfo(null)}
                              className="text-gray-400 hover:text-gray-600 transition-colors ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <textarea
                    placeholder="YouTube URL, 웹사이트 URL, 또는 요약하고 싶은 텍스트를 입력해주세요..."
                    value={inputContent}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`w-full h-full border-0 focus:outline-none resize-none bg-transparent ${
                      youtubeInfo || uploadedFile || websiteInfo ? 'p-4 pr-12 pt-16' : 'p-4 pr-12'
                    } ${isDragOver ? 'bg-blue-50/50' : ''}`}
                    disabled={loading}
                  />
                  
                  {/* 파일 첨부 버튼 */}
                  <label className="absolute bottom-3 left-3 w-10 h-10 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-all cursor-pointer flex items-center justify-center border border-gray-200">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={handleFileInputChange}
                      className="hidden"
                      title="지원되는 형식: PDF, Word(.docx/.doc), 텍스트(.txt). 한글 문서(.hwp)는 지원되지 않습니다."
                    />
                    <Upload className="w-5 h-5" />
                  </label>
                  
                  <button
                    onClick={handleGenerateSummary}
                    disabled={!canGenerate()}
                    className="absolute bottom-3 right-3 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-800 font-medium">오류 발생</div>
                  <div className="text-red-600 text-sm mt-1">{error}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 고정 버튼들 */}
      {summary && (
        <div className="fixed right-8 top-1/2 transform -translate-y-1/2 z-50">
          <div className="flex flex-col gap-3">
            <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-800 to-black text-white rounded-lg hover:from-gray-900 hover:to-gray-800 transition-all duration-200 shadow-lg transform hover:scale-105">
              <Download className="w-4 h-4" />
              다운로드
            </button>
            <button 
              onClick={handleCopySummary}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-800 to-black text-white rounded-lg hover:from-gray-900 hover:to-gray-800 transition-all duration-200 shadow-lg transform hover:scale-105"
            >
              <Copy className="w-4 h-4" />
              복사
            </button>
            <button 
              onClick={handleNewSummary}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-800 to-black text-white rounded-lg hover:from-gray-900 hover:to-gray-800 transition-all duration-200 shadow-lg transform hover:scale-105"
            >
              <ArrowLeft className="w-4 h-4" />
              새 요약
            </button>
          </div>
        </div>
      )}

      {/* 로그인 모달 */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">로그인이 필요합니다</h2>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="text-gray-600 mb-6">
              <p className="mb-4">AI 완벽요약 기능을 사용하려면 로그인이 필요합니다.</p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">플랜별 사용량</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Basic:</strong> 2회</li>
                  <li>• <strong>Standard:</strong> 무제한</li>
                  <li>• <strong>Pro:</strong> 무제한</li>
                </ul>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/auth/signin')}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                로그인하기
              </button>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                나중에
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 메시지 */}
      {showToast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 p-3 rounded-lg shadow-lg ${
          toastType === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toastMessage}
        </div>
      )}
    </div>
  );
} 