"use client";
import React, { useState, useEffect } from "react";
import { useSession } from 'next-auth/react';
import Header from '../../components/Header';
import {
  ArrowLeft, Youtube, FileText, Globe, Type, Upload, Download, Copy, X, Send
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import LogoLoading from '@/components/LogoLoading';
import { useToast } from "@/contexts/ToastContext";
import { createUsageToastData, createUsageToastMessage } from "@/lib/toast-utils";
import SummaryEditorEmbed from '@/components/SummaryEditorEmbed';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export default function AISummary() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const [inputContent, setInputContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputType, setInputType] = useState<'auto' | 'youtube' | 'document' | 'website' | 'text'>('auto');
  const [showSpeechBubble, setShowSpeechBubble] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [youtubeInfo, setYoutubeInfo] = useState<{title: string, url: string} | null>(null);
  const [websiteInfo, setWebsiteInfo] = useState<{title: string, url: string, favicon: string} | null>(null);
  const [showInput, setShowInput] = useState(true);
  const [youtubeVideoInfo, setYoutubeVideoInfo] = useState<{title: string, thumbnail: string, duration: string, channel: string, url: string} | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [embedIndex, setEmbedIndex] = useState(0);
  const [embedError, setEmbedError] = useState(false);
  const [showCustomToast, setShowCustomToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [editedSummary, setEditedSummary] = useState<string>('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      // setIsLoginModalOpen(true); // Removed as per edit hint
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
    if (!url) return null;
    
    console.log('extractVideoId 호출됨, URL:', url);
    
    const patterns = [
      // youtube.com/watch?v=VIDEO_ID
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      // youtu.be/VIDEO_ID
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      // youtube.com/embed/VIDEO_ID
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      // youtube.com/watch?v=VIDEO_ID&other_params
      /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
      // 더 일반적인 패턴
      /[?&]v=([a-zA-Z0-9_-]{11})/,
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = url.match(pattern);
      console.log(`패턴 ${i + 1} 시도:`, pattern, '결과:', match);
      if (match && match[1]) {
        console.log('비디오 ID 추출 성공:', match[1]);
        return match[1];
      }
    }
    
    console.log('비디오 ID 추출 실패');
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
          thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: data.duration || '',
          channel: data.channel || '',
          url: url
        });
      } else {
        // API 키가 없거나 실패한 경우 기본 정보로 fallback
        const errorData = await response.json();
        console.log('YouTube API 실패, 기본 정보 사용:', errorData);
        
        // 기본 YouTube 정보 설정
        setYoutubeInfo({ title: 'YouTube 영상', url });
        setYoutubeVideoInfo({
          title: 'YouTube 영상',
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: '',
          channel: 'YouTube',
          url: url
        });
      }
    } catch (error) {
      console.log('YouTube 정보 가져오기 실패, 기본 정보 사용:', error);
      
      // 에러 발생 시에도 기본 정보 설정
      const videoId = extractVideoId(url);
      if (videoId) {
        setYoutubeInfo({ title: 'YouTube 영상', url });
        setYoutubeVideoInfo({
          title: 'YouTube 영상',
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: '',
          channel: 'YouTube',
          url: url
        });
      }
    }
  };

  const extractWebsiteInfo = async (url: string) => {
    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
      
      if (response.ok) {
        try {
          const data = await response.json();
          setWebsiteInfo({ title: data.title || new URL(url).hostname.replace(/^www\./,''), url, favicon: data.image || '' });
        } catch {
          // JSON 파싱 실패 시 폴백
          setWebsiteInfo({ title: new URL(url).hostname.replace(/^www\./,''), url, favicon: '' });
        }
      } else {
        // 비정상 응답(404 등) 본문을 소비해 콘솔 오류 방지 후 폴백
        await response.text().catch(() => '');
        setWebsiteInfo({ title: new URL(url).hostname.replace(/^www\./,''), url, favicon: '' });
      }
    } catch (error) {
      // 네트워크/기타 오류 시에도 조용히 폴백
      try {
        setWebsiteInfo({ title: new URL(url).hostname.replace(/^www\./,''), url, favicon: '' });
      } catch {
        setWebsiteInfo({ title: '웹사이트', url, favicon: '' });
      }
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
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          duration: '',
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
      // setIsLoginModalOpen(true); // Removed as per edit hint
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
        
        // 사용량 증가 Toast 알림 표시 (실제 사용량 데이터 사용)
        if (data.usage) {
          const toastData = createUsageToastData('ai-summary', data.usage.current, data.usage.limit);
          showToast({
            type: 'success',
            title: `${toastData.serviceName} 사용`,
            message: createUsageToastMessage(toastData),
            duration: 5000
          });
        } else {
          // Fallback to hardcoded values if usage data is not available
          const toastData = createUsageToastData('ai-summary', 0, 30);
          showToast({
            type: 'success',
            title: `${toastData.serviceName} 사용`,
            message: createUsageToastMessage(toastData),
            duration: 5000
          });
        }
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

  const showCustomToastMessage = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowCustomToast(true);
    setTimeout(() => setShowCustomToast(false), 3000);
  };

  const handleCopySummary = async () => {
    if (summary) {
      try {
        await navigator.clipboard.writeText(summary);
        showCustomToastMessage('요약 내용이 클립보드에 복사되었습니다!', 'success');
      } catch (error) {
        console.error('복사 실패:', error);
        // 대안 방법: 텍스트 영역을 생성하여 복사
        const textArea = document.createElement('textarea');
        textArea.value = summary;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          showCustomToastMessage('요약 내용이 클립보드에 복사되었습니다!', 'success');
        } catch (fallbackError) {
          console.error('대안 복사 방법도 실패:', fallbackError);
          showCustomToastMessage('복사에 실패했습니다. 수동으로 복사해주세요.', 'error');
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
                <LogoLoading message="요약 생성 중..." subMessage="AI가 내용을 요약하고 있어요" transparentBg />
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
                          {(() => {
                            const videoId = extractVideoId(youtubeVideoInfo.url);
                            console.log('플레이어 렌더링 - videoId:', videoId);
                            console.log('플레이어 렌더링 - URL:', youtubeVideoInfo.url);
                            
                            if (!videoId) {
                              return (
                                <div className="w-[800px] h-[450px] bg-gray-200 rounded-lg flex items-center justify-center">
                                  <div className="text-center">
                                    <p className="text-gray-600 mb-2">영상을 불러올 수 없습니다.</p>
                                    <p className="text-sm text-gray-500">URL: {youtubeVideoInfo.url}</p>
                                    <button 
                                      onClick={() => window.open(youtubeVideoInfo.url, '_blank')}
                                      className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    >
                                      YouTube에서 보기
                                    </button>
                                  </div>
                                </div>
                              );
                            }
                            
                            // 여러 embed URL 옵션 시도
                            const embedOptions = [
                              `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`,
                              `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
                              `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
                              `https://www.youtube.com/embed/${videoId}`
                            ];
                            
                            const embedUrl = embedOptions[embedIndex];
                            console.log('임베드 URL 시도 중:', embedUrl, '인덱스:', embedIndex);
                            
                            const handleIframeError = () => {
                              console.log('iframe 에러 발생, 다음 옵션 시도');
                              setEmbedError(true);
                              if (embedIndex < embedOptions.length - 1) {
                                setTimeout(() => {
                                  setEmbedIndex(prev => prev + 1);
                                  setEmbedError(false);
                                }, 1000);
                              } else {
                                // 모든 임베드 옵션 실패 → 임베드 금지로 판단하고 새 탭으로 오픈
                                try {
                                  window.open(youtubeVideoInfo.url, '_blank');
                                  showCustomToastMessage('임베드가 차단되어 새 탭에서 열었습니다.', 'success');
                                } catch (e) {
                                  console.warn('새 탭 열기 실패', e);
                                }
                                // 플레이어 닫고 상태 초기화
                                setShowVideoPlayer(false);
                                setEmbedIndex(0);
                                setEmbedError(false);
                              }
                            };
                            
                            const handleIframeLoad = () => {
                              console.log('iframe 로드 완료:', embedUrl);
                              setEmbedError(false);
                            };
                            
                            if (embedError && embedIndex >= embedOptions.length - 1) {
                              return (
                                <div className="w-[800px] h-[450px] bg-gray-100 rounded-lg flex items-center justify-center">
                                  <div className="text-center">
                                    <p className="text-gray-600 mb-4">내장 플레이어를 불러올 수 없습니다.</p>
                                    <div className="space-y-2">
                                      <button 
                                        onClick={() => window.open(youtubeVideoInfo.url, '_blank')}
                                        className="block mx-auto px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                      >
                                        YouTube에서 보기
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setEmbedIndex(0);
                                          setEmbedError(false);
                                        }}
                                        className="block mx-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                                      >
                                        다시 시도
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="w-[800px] h-[450px] bg-black rounded-lg overflow-hidden relative">
                                {embedError && (
                                  <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
                                    <div className="text-center">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
                                      <p className="text-gray-600">다른 방법으로 로딩 중...</p>
                                    </div>
                                  </div>
                                )}
                                <iframe
                                  key={`${videoId}-${embedIndex}`}
                                  width="800"
                                  height="450"
                                  src={embedUrl}
                                  title={youtubeVideoInfo.title}
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                                  allowFullScreen
                                  className="w-full h-full"
                                  onLoad={handleIframeLoad}
                                  onError={handleIframeError}
                                  style={{ border: 'none' }}
                                ></iframe>
                              </div>
                            );
                          })()}
                          <button
                            onClick={() => {
                              console.log('플레이어 닫기 클릭');
                              setShowVideoPlayer(false);
                              setEmbedIndex(0);
                              setEmbedError(false);
                            }}
                            className="absolute top-2 right-2 w-8 h-8 bg-black bg-opacity-70 text-white rounded-full flex items-center justify-center hover:bg-opacity-90 transition-all z-10"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="relative cursor-pointer bg-gray-100 rounded-lg p-4 group" 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const videoId = extractVideoId(youtubeVideoInfo.url);
                            console.log('썸네일 클릭됨');
                            console.log('URL:', youtubeVideoInfo.url);
                            console.log('추출된 videoId:', videoId);
                            if (videoId) {
                              // 플레이어 상태 초기화
                              setEmbedIndex(0);
                              setEmbedError(false);
                              setShowVideoPlayer(true);
                            } else {
                              console.error('비디오 ID를 추출할 수 없습니다:', youtubeVideoInfo.url);
                            }
                          }}
                        >
                          <img 
                            src={youtubeVideoInfo.thumbnail} 
                            alt={youtubeVideoInfo.title}
                            className="w-[600px] h-[338px] rounded-lg object-cover shadow-xl hover:shadow-2xl transition-shadow"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const videoId = extractVideoId(youtubeVideoInfo.url);
                              if (videoId) {
                                // 여러 썸네일 옵션을 순차적으로 시도
                                if (target.src.includes('maxresdefault')) {
                                  target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                } else if (target.src.includes('hqdefault')) {
                                  target.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                                } else if (target.src.includes('mqdefault')) {
                                  target.src = `https://img.youtube.com/vi/${videoId}/default.jpg`;
                                } else {
                                  // 마지막 폴백: 기본 YouTube 로고
                                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMzOCIgdmlld0JveD0iMCAwIDYwMCAzMzgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2MDAiIGhlaWdodD0iMzM4IiBmaWxsPSIjRkY0NDQ0Ii8+CjxwYXRoIGQ9Ik0yNDAgMTY5TDM2MCAyMzlMMjQwIDMwOVYxNjlaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K';
                                }
                              }
                            }}
                          />
                          {youtubeVideoInfo.duration ? (
                            <div className="absolute bottom-3 right-3 bg-black bg-opacity-80 text-white text-sm px-3 py-1 rounded">
                              {youtubeVideoInfo.duration}
                            </div>
                          ) : null}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 rounded-lg">
                            <div className="flex gap-3">
                              <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors">
                                <svg className="w-10 h-10 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5v14l11-7z"/>
                                </svg>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(youtubeVideoInfo.url, '_blank');
                                }}
                                className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-700 transition-colors"
                                title="YouTube에서 보기"
                              >
                                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* 결과 내용 카드는 제거하고 에디터만 노출 */}

                  {/* 요약 결과 편집기 */}
                  {summary && (
                    <div className="p-6 bg-white rounded-xl shadow-lg border border-gray-200 w-full">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">요약 결과</h3>
                      {/* 미리보기 제거: 에디터만 노출 */}
                      <SummaryEditorEmbed 
                        initialContent={summary || ''}
                        initialTitle={(youtubeVideoInfo?.title || websiteInfo?.title || '요약 결과')}
                        height={560}
                        layout="split"
                        hideChat={false}
                        onContentChange={(t) => setEditedSummary(t)}
                      />
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
            <button onClick={async () => {
              try {
                const children: Paragraph[] = [];
                const docTitle = (youtubeVideoInfo?.title || websiteInfo?.title || '요약 결과');
                children.push(new Paragraph({ text: docTitle, heading: HeadingLevel.TITLE }));
                children.push(new Paragraph({ text: " " }));
                (editedSummary || summary || '').split(/\n/).forEach(line => children.push(new Paragraph({ children: [new TextRun(line)] })));
                const doc = new Document({ sections: [{ children }] });
                const blob = await Packer.toBlob(doc);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${docTitle.replace(/\s+/g, '_')}_${Date.now()}.docx`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
              } catch (e) { console.error(e); }
            }} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-800 to-black text-white rounded-lg hover:from-gray-900 hover:to-gray-800 transition-all duration-200 shadow-lg transform hover:scale-105">
              <Download className="w-4 h-4" />
              다운로드
            </button>
            <button 
              onClick={async () => {
                const text = editedSummary || summary || '';
                try {
                  await navigator.clipboard.writeText(text);
                  showCustomToastMessage('요약 내용이 클립보드에 복사되었습니다!', 'success');
                } catch (error) {
                  const textArea = document.createElement('textarea');
                  textArea.value = text;
                  document.body.appendChild(textArea);
                  textArea.select();
                  try {
                    document.execCommand('copy');
                    showCustomToastMessage('요약 내용이 클립보드에 복사되었습니다!', 'success');
                  } catch (fallbackError) {
                    showCustomToastMessage('복사에 실패했습니다. 수동으로 복사해주세요.', 'error');
                  }
                  document.body.removeChild(textArea);
                }
              }}
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
      {/* Removed as per edit hint */}

      {/* 토스트 메시지 */}
              {showCustomToast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 p-3 rounded-lg shadow-lg ${
          toastType === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toastMessage}
        </div>
      )}
    </div>
  );
} 