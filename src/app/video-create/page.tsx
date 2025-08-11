"use client";
import { useState, useEffect } from "react";
import Header from '../components/Header';

import {
  Download, X, Paperclip, ChevronDown, RefreshCw, Play, Plus, History, Trash2, Clock
} from 'lucide-react';

export default function VideoCreate() {
  const [userInput, setUserInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("kling");
  const [selectedSize, setSelectedSize] = useState("16:9");
  const [selectedResolution, setSelectedResolution] = useState("720p");
  const [selectedDuration, setSelectedDuration] = useState("5초");
  const [loading, setLoading] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showResolutionDropdown, setShowResolutionDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // 영상 히스토리 관련 상태
  const [dbHistory, setDbHistory] = useState<VideoHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 영상 히스토리 인터페이스 정의
  interface VideoHistoryItem {
    id: number;
    prompt: string;
    generatedVideoUrl: string;
    model: string;
    size: string;
    duration: string;
    resolution: string;
    style: string;
    quality: string;
    title: string;
    createdAt: string;
    status: string;
  }

  // URL 파라미터에서 이미지 URL을 받아서 자동으로 첨부
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const imageUrl = urlParams.get('imageUrl');
    
    if (imageUrl) {
      // DALL-E 3 이미지인지 확인 (Azure Blob Storage URL)
      const isDalleImage = imageUrl.includes('oaidalleapiprodscus.blob.core.windows.net') || 
                          imageUrl.includes('dalleproduseast.blob.core.windows.net');
      
      // 프록시 API를 통해 이미지 가져오기
      const fetchUrl = isDalleImage 
        ? `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
        : imageUrl;
      
      fetch(fetchUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`이미지 가져오기 실패: ${response.status}`);
          }
          return response.blob();
        })
        .then(blob => {
          const file = new File([blob], 'generated-image.png', { type: 'image/png' });
          setAttachedFiles([file]);
          console.log('✅ 이미지 첨부 성공');
        })
        .catch(error => {
          console.error('이미지 첨부 실패:', error);
        });
    }
  }, []);

  // 로딩 진행률 애니메이션
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (loading) {
      setLoadingProgress(0);
      
      // Kling 모델의 경우 200초 동안 천천히 올라가도록 설정
      if (selectedModel === "kling") {
        const totalDuration = 200000; // 200초 (밀리초)
        const updateInterval = 600; // 0.6초마다 업데이트 (더 천천히)
        const incrementPerUpdate = (99 / (totalDuration / updateInterval)); // 99%까지 균등하게 분배
        
        interval = setInterval(() => {
          setLoadingProgress(prev => {
            if (prev >= 99) {
              return 99; // 99%에서 멈춤
            }
            return prev + incrementPerUpdate;
          });
        }, updateInterval);
      } else if (selectedModel === "Minimax") {
        // Minimax 모델의 경우 120초 동안 천천히 올라가도록 설정
        const totalDuration = 120000; // 120초 (밀리초)
        const updateInterval = 500; // 0.5초마다 업데이트
        const incrementPerUpdate = (99 / (totalDuration / updateInterval)); // 99%까지 균등하게 분배
        
        interval = setInterval(() => {
          setLoadingProgress(prev => {
            if (prev >= 99) {
              return 99; // 99%에서 멈춤
            }
            return prev + incrementPerUpdate;
          });
        }, updateInterval);
      } else if (selectedModel === "Runway") {
        // Runway 모델의 경우 30초 동안 천천히 올라가도록 설정
        const totalDuration = 30000; // 30초 (밀리초)
        const updateInterval = 300; // 0.3초마다 업데이트
        const incrementPerUpdate = (99 / (totalDuration / updateInterval)); // 99%까지 균등하게 분배
        
        interval = setInterval(() => {
          setLoadingProgress(prev => {
            if (prev >= 99) {
              return 99; // 99%에서 멈춤
            }
            return prev + incrementPerUpdate;
          });
        }, updateInterval);
      } else {
        // 다른 모델들은 기존 방식 (랜덤하게 증가)
        interval = setInterval(() => {
          setLoadingProgress(prev => {
            if (prev >= 95) {
              return prev; // 95%에서 멈춤
            }
            return prev + Math.random() * 15; // 랜덤하게 증가
          });
        }, 500);
      }
    } else {
      setLoadingProgress(0);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [loading, selectedModel]);

  const models = [
    { name: "kling", description: "시네마틱한 고품질 영상", image: "/images/models/kling.jpg" },
    { name: "Minimax", description: "부드러운 움직임의 빠른 영상", image: "/images/models/minimax.jpg" },
    { name: "Runway", description: "예술적이고 창의적인 영상", image: "/images/models/runway.jpg" }
  ];

  const sizes = [
    { name: "16:9", description: "가로형 영상", width: 1920, height: 1080 },
    { name: "9:16", description: "세로형 영상", width: 1080, height: 1920 }
  ];

  const resolutions = [
    { name: "720p", description: "표준 해상도", value: "720p" },
    { name: "1080p", description: "고해상도", value: "1080p" }
  ];

  const durations = [
    { name: "5초", description: "표준 영상", seconds: 5 },
    { name: "10초", description: "긴 영상", seconds: 10 }
  ];

  // 선택된 모델에 따라 지원되는 duration 필터링
  const getSupportedDurations = () => {
    switch (selectedModel) {
      case "Minimax":
        return durations.filter(d => d.seconds === 5); // Minimax는 5초만 지원
      default:
        return durations; // 다른 모델들은 5초, 10초 모두 지원
    }
  };

  // 모델별 프롬프트 힌트 제공
  const getPromptHint = () => {
    switch (selectedModel) {
      case "kling":
        return "예: 고품질의 영화같은 영상을 만들어주세요. 자연스러운 움직임과 시네마틱한 조명을 원해요.";
      case "Minimax":
        return "예: 부드러운 움직임으로 영상을 만들어주세요. 자연스러운 전환을 원해요.";
      case "Runway":
        return "예: 예술적이고 창의적인 영상을 만들어주세요. 독특한 스타일과 효과를 원해요.";
      default:
        return "어떤 영상을 만들고 싶으신가요?";
    }
  };

  // 선택된 모델에 따라 지원되는 해상도 필터링
  const getSupportedResolutions = () => {
    switch (selectedModel) {
      case "kling":
      case "Runway":
        return resolutions; // 720p, 1080p 모두 지원
      case "Minimax":
        return resolutions.filter(r => r.value === "720p"); // Minimax는 720p만 지원
      default:
        return resolutions.filter(r => r.value === "720p");
    }
  };

  const getSelectedSize = () => {
    const selectedSizeObj = sizes.find(size => size.name === selectedSize);
    return selectedSizeObj || sizes[0];
  };

  const getSelectedResolution = () => {
    const supportedResolutions = getSupportedResolutions();
    const selectedResolutionObj = supportedResolutions.find(resolution => resolution.value === selectedResolution);
    return selectedResolutionObj || supportedResolutions[0];
  };

  const getSelectedDuration = () => {
    const selectedDurationObj = durations.find(duration => duration.name === selectedDuration);
    return selectedDurationObj || durations[0];
  };

  const getContainerStyle = () => {
    const size = getSelectedSize();
    const aspectRatio = size.width / size.height;
    
    // 컨테이너 크기를 고정 (가로형: 900x506, 세로형: 400x711)
    return {
      aspectRatio: aspectRatio,
      maxWidth: aspectRatio > 1 ? '900px' : '400px',
      maxHeight: aspectRatio > 1 ? '506px' : '711px',
      width: '100%',
      height: 'auto',
      minWidth: aspectRatio > 1 ? '700px' : '300px',
      minHeight: aspectRatio > 1 ? '394px' : '533px'
    };
  };

  const handleFileAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    // 한 장만 첨부 가능하도록 첫 번째 파일만 사용
    if (files.length > 0) {
      setAttachedFiles([files[0]]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files);
    // 한 장만 첨부 가능하도록 첫 번째 파일만 사용
    if (files.length > 0) {
      setAttachedFiles([files[0]]);
    }
  };

  const removeAttachedFile = () => {
    setAttachedFiles([]);
  };

  const handleDownloadVideo = () => {
    if (generatedVideo) {
      const link = document.createElement('a');
      link.href = generatedVideo;
      link.download = `generated-video-${Date.now()}.mp4`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('영상 다운로드 완료');
    } else {
      console.error('다운로드할 영상이 없습니다');
    }
  };

  const handleNewVideo = () => {
    setGeneratedVideo(null);
    setUserInput("");
    setAttachedFiles([]);
  };

  const handleGenerate = async () => {
    if (!userInput.trim()) return;
    
    setLoading(true);
    setError(null);
    setGeneratedVideo(null);
    
    try {
      const selectedDurationObj = getSelectedDuration();
      const selectedSizeObj = getSelectedSize();
      const selectedResolutionObj = getSelectedResolution();
      const formData = new FormData();
      
      let finalPrompt = userInput;
      
      formData.append('prompt', finalPrompt);
      formData.append('duration', selectedDuration);
      formData.append('seconds', selectedDurationObj.seconds.toString());
      formData.append('model', selectedModel);
      formData.append('size', `${selectedSizeObj.width}:${selectedSizeObj.height}`);
      formData.append('resolution', selectedResolutionObj.value);
      
      if (attachedFiles.length > 0) {
        attachedFiles.forEach(file => {
          formData.append('referenceImages', file);
        });
      }

      const res = await fetch("/api/video-generate", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('영상 생성에 실패했습니다.');
      }
      
      const data = await res.json();
      
      if (data.url && typeof data.url === 'string' && data.url.trim() !== '') {
        setGeneratedVideo(data.url);
        // 영상 생성 성공 후 히스토리 새로고침
        setTimeout(() => {
          loadHistory();
        }, 1000); // 1초 후 히스토리 새로고침
      } else {
        throw new Error('영상 생성에 실패했습니다. 유효한 URL을 받지 못했습니다.');
      }
    } catch (err) {
      console.error('영상 생성 에러:', err);
      
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("서버 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModelDropdown = () => {
    setShowModelDropdown(!showModelDropdown);
    setShowSizeDropdown(false);
    setShowResolutionDropdown(false);
    setShowDurationDropdown(false);
  };

  const handleSizeDropdown = () => {
    setShowSizeDropdown(!showSizeDropdown);
    setShowModelDropdown(false);
    setShowResolutionDropdown(false);
    setShowDurationDropdown(false);
  };

  const handleResolutionDropdown = () => {
    setShowResolutionDropdown(!showResolutionDropdown);
    setShowModelDropdown(false);
    setShowSizeDropdown(false);
    setShowDurationDropdown(false);
  };

  const handleDurationDropdown = () => {
    setShowDurationDropdown(!showDurationDropdown);
    setShowModelDropdown(false);
    setShowSizeDropdown(false);
    setShowResolutionDropdown(false);
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value);
  };

  const handleDurationChange = (durationName: string) => {
    setSelectedDuration(durationName);
    setShowDurationDropdown(false);
  };

  // 영상 히스토리 로드
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const response = await fetch('/api/video-generate/history');
      const data = await response.json();
      
      if (data.success) {
        setDbHistory(data.history);
        console.log('✅ 영상 히스토리 로드 완료:', data.history);
      } else {
        console.error('❌ 영상 히스토리 로드 실패:', data.error);
      }
    } catch (error) {
      console.error('❌ 영상 히스토리 로드 오류:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 영상 히스토리 삭제
  const deleteHistoryItem = async (id: number) => {
    try {
      const response = await fetch(`/api/video-generate/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setDbHistory(prev => prev.filter(item => item.id !== id));
        console.log('✅ 영상 히스토리 삭제 완료');
      } else {
        console.error('❌ 영상 히스토리 삭제 실패');
      }
    } catch (error) {
      console.error('❌ 영상 히스토리 삭제 오류:', error);
    }
  };

  // 영상 히스토리 불러오기
  const loadHistoryItem = (item: VideoHistoryItem) => {
    setUserInput(item.title); // 원본 프롬프트로 설정
    setSelectedModel(item.model);
    setSelectedSize(item.size);
    setSelectedResolution(item.resolution);
    setSelectedDuration(item.duration);
    setGeneratedVideo(item.generatedVideoUrl);
    console.log('✅ 영상 히스토리 불러오기 완료:', item);
  };

  // 컴포넌트 마운트 시 히스토리 로드
  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white">
        <div className="flex">
          
          <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-8">
            {!loading && !generatedVideo && attachedFiles.length === 0 ? (
              // 초기 화면 - 이미지 첨부 전
              <div className="text-center">
                <h1 className="text-4xl font-semibold text-gray-800 mb-8">
                  영상을 생성해드립니다!
                </h1>
              </div>
            ) : (
              // 영상 생성 영역 (이미지 첨부 후 또는 영상 생성 후)
              <div className="mb-16">
                <div className="bg-white rounded-2xl flex items-center justify-center relative" style={getContainerStyle()}>
                  {loading ? (
                    <div className="text-center w-full h-full flex flex-col items-center justify-center bg-white rounded-xl">
                      <div className="relative flex items-center justify-center">
                        <div className="text-black font-bold text-5xl z-10 relative">MOA</div>
                        <div className="absolute top-16 text-black text-lg font-medium z-10 text-left w-full whitespace-nowrap -ml-6">AI가 영상 제작중</div>
                        <div className="absolute w-60 h-60 border-2 border-black border-t-transparent rounded-full animate-spin flex items-center justify-center">
                          <div className="w-48 h-48 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '2s'}}></div>
                        </div>
                      </div>
                      
                      {/* 진행률 게이지 */}
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
                        <div className="w-64 h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                          <div 
                            className="h-full bg-black rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${loadingProgress}%` }}
                          ></div>
                        </div>
                        <div className="text-black text-lg font-medium">
                          {Math.round(loadingProgress)}%
                        </div>
                      </div>
                    </div>
                  ) : generatedVideo && generatedVideo.trim() !== '' ? (
                    <div className="text-center w-full h-full relative group">
                      <div className="w-full h-full rounded-xl overflow-hidden bg-gray-900" style={getContainerStyle()}>
                        <video
                          src={generatedVideo}
                          controls
                          className="w-full h-full object-cover"
                          onError={(e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
                            console.error('영상 로드 실패:', generatedVideo);
                            const target = e.target as HTMLVideoElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-500">영상을 불러올 수 없습니다</div>';
                            }
                          }}
                        />
                        
                        <div className="absolute top-4 right-4 z-10 video-menu-container opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="flex gap-2">
                            <div className="relative group/button">
                              <button
                                onClick={handleDownloadVideo}
                                className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all"
                              >
                                <Download className="w-5 h-5 text-gray-700" />
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover/button:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                영상 다운로드
                              </div>
                            </div>
                            <div className="relative group/button">
                              <button
                                onClick={handleNewVideo}
                                className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all"
                              >
                                <RefreshCw className="w-5 h-5 text-gray-700" />
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover/button:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                새로 만들기
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : attachedFiles.length > 0 ? (
                    // 첨부된 이미지 표시
                    <div className="text-center w-full h-full relative group">
                      <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center bg-gray-100" style={getContainerStyle()}>
                        <div className="relative w-full h-full flex items-center justify-center">
                          <img
                            src={URL.createObjectURL(attachedFiles[0])}
                            alt="참고 이미지"
                            className="max-w-[80%] max-h-[80%] object-contain"
                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                              console.error('이미지 로드 실패');
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-500">이미지를 불러올 수 없습니다</div>';
                              }
                            }}
                          />
                        </div>
                        
                        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <div className="flex gap-2">
                            <div className="relative group/button">
                              <button
                                onClick={removeAttachedFile}
                                className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all"
                              >
                                <X className="w-5 h-5 text-gray-700" />
                              </button>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover/button:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                이미지 제거
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center w-full h-full flex items-center justify-center">
                      {/* 빈 상태 */}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 입력창 영역 (아래쪽) */}
            <div className="w-full max-w-4xl mt-8">
              <div className="flex items-center gap-4 mb-6 justify-center h-12">
                {/* 모델 선택 */}
                <div className="relative">
                  <button
                    onClick={handleModelDropdown}
                    className="flex items-center gap-2 px-3 py-2 border-2 border-gray-400 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-md w-[200px] hover:border-gray-500 hover:shadow-lg transition-all"
                  >
                    <div className="w-8 h-8 rounded overflow-hidden">
                      {(() => {
                        const selectedModelData = models.find(model => model.name === selectedModel);
                        return selectedModelData?.image ? (
                          <img
                            src={selectedModelData.image}
                            alt={selectedModel}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                            style={{
                              imageRendering: 'crisp-edges'
                            }}
                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const fallback = document.createElement('div');
                                fallback.className = 'w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center';
                                fallback.innerHTML = `<span class="text-white text-xs font-bold">${selectedModel.substring(0, 2).toUpperCase()}</span>`;
                                parent.appendChild(fallback);
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">{selectedModel.substring(0, 2).toUpperCase()}</span>
                          </div>
                        );
                      })()}
                    </div>
                    <span className="font-medium truncate text-gray-800">{selectedModel}</span>
                    <ChevronDown className="w-4 h-4 text-gray-700" />
                  </button>
                  {showModelDropdown && (
                    <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {models.map((model) => (
                        <button
                          key={model.name}
                          onClick={() => {
                            setSelectedModel(model.name);
                            setShowModelDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{model.name}</span>
                            <span className="text-xs text-gray-500">{model.description}</span>
                          </div>
                          <div className="w-10 h-10 rounded-lg overflow-hidden">
                            {model.image ? (
                              <img
                                src={model.image}
                                alt={model.name}
                                width={40}
                                height={40}
                                className="w-full h-full object-cover"
                                style={{
                                  imageRendering: 'crisp-edges'
                                }}
                                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const fallback = document.createElement('div');
                                    fallback.className = 'w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center';
                                    fallback.innerHTML = `<span class="text-white text-xs font-bold">${model.name.substring(0, 2).toUpperCase()}</span>`;
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{model.name.substring(0, 2).toUpperCase()}</span>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 영상 시간 */}
                <div className="relative">
                  <button
                    onClick={handleDurationDropdown}
                    className="flex items-center gap-2 px-3 py-2 border-2 border-gray-400 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-md min-w-[120px] hover:border-gray-500 hover:shadow-lg transition-all"
                  >
                    <span className="font-medium text-gray-800">{selectedDuration}</span>
                    <ChevronDown className="w-4 h-4 text-gray-700" />
                  </button>
                  {showDurationDropdown && (
                    <div className="absolute bottom-full left-0 mb-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {getSupportedDurations().map((duration) => (
                        <button
                          key={duration.name}
                          onClick={() => handleDurationChange(duration.name)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex flex-col"
                        >
                          <span className="font-medium text-gray-900">{duration.name}</span>
                          <span className="text-xs text-gray-500">{duration.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 해상도 */}
                <div className="relative">
                  <button
                    onClick={handleResolutionDropdown}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm min-w-[120px]"
                  >
                    <span className="font-medium">{selectedResolution}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  {showResolutionDropdown && (
                    <div className="absolute bottom-full left-0 mb-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {getSupportedResolutions().map((resolution) => (
                        <button
                          key={resolution.value}
                          onClick={() => {
                            setSelectedResolution(resolution.value);
                            setShowResolutionDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{resolution.name}</span>
                            <span className="text-xs text-gray-500">{resolution.description}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 영상 비율 */}
                <div className="relative">
                  <button
                    onClick={handleSizeDropdown}
                    disabled={generatedVideo !== null}
                    className={`flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm min-w-[120px] ${
                      generatedVideo !== null ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="font-medium">{selectedSize}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  {showSizeDropdown && generatedVideo === null && (
                    <div className="absolute bottom-full left-0 mb-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {sizes.map((size) => (
                        <button
                          key={size.name}
                          onClick={() => {
                            setSelectedSize(size.name);
                            setShowSizeDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{size.name}</span>
                            <span className="text-xs text-gray-500">{size.description}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="max-w-3xl mx-auto">
                {attachedFiles.length === 0 ? (
                  // 이미지 첨부 전: 이미지 첨부 영역만 표시
                  <div className="flex-1">
                    <label className="block cursor-pointer">
                      <div 
                        className="relative bg-white border-2 border-gray-200 rounded-xl shadow-sm transition-all duration-300 hover:border-blue-500 hover:ring-2 hover:ring-blue-200"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <div className="w-full px-4 py-8 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                              <Plus className="w-6 h-6 text-black" />
                            </div>
                            <div>
                              <p className="text-lg font-medium text-gray-900">이미지를 첨부해주세요</p>
                              <p className="text-sm text-gray-500 mt-1">영상 생성을 위해 이미지가 필요합니다</p>
                            </div>
                          </div>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileAttach}
                          multiple
                          className="hidden"
                        />
                      </div>
                    </label>
                  </div>
                ) : (
                  // 이미지 첨부 후: 입력창과 생성 버튼 표시
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="relative bg-white border-2 border-gray-200 rounded-xl shadow-sm transition-all duration-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
                        <input
                          type="text"
                          value={userInput}
                          onChange={handlePromptChange}
                          placeholder={getPromptHint()}
                          className="w-full px-4 py-3 pr-12 border-none rounded-xl bg-white focus:outline-none text-gray-900 shadow-none transition-all"
                          disabled={loading}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !loading && userInput.trim()) {
                              handleGenerate();
                            }
                          }}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                          <label className="cursor-pointer p-1 transition-colors text-gray-500 hover:text-gray-700" title="이미지 변경">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFileAttach}
                              className="hidden"
                            />
                            <Paperclip className="w-4 h-4" />
                          </label>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!userInput.trim()) {
                          const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
                          if (inputElement) {
                            inputElement.focus();
                          }
                        } else {
                          handleGenerate();
                        }
                      }}
                      disabled={loading}
                      className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 border-2 shadow-md text-base font-medium ${
                        !userInput.trim() 
                          ? 'bg-gray-400 text-gray-600 border-gray-400 cursor-pointer hover:bg-gray-500 hover:border-gray-500' 
                          : loading 
                            ? 'bg-gray-500 text-white border-gray-500 cursor-not-allowed'
                            : 'bg-black text-white border-black hover:bg-gray-800 hover:border-gray-800 hover:shadow-lg'
                      }`}
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          생성 중...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          생성
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center max-w-3xl mx-auto">
                  {error}
                </div>
              )}

              {/* 영상 생성 히스토리 섹션 */}
              <div className="mt-8 max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <History className="w-5 h-5" />
                    최근 생성된 영상
                  </h3>
                  <button
                    onClick={loadHistory}
                    disabled={loadingHistory}
                    className="flex items-center gap-2 px-3 py-1.5 bg-transparent border-none p-2 rounded-md hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                    새로고침
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-gray-500 text-sm">히스토리를 불러오는 중...</p>
                  </div>
                ) : dbHistory.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">생성된 영상이 없습니다</p>
                    <p className="text-gray-400 text-xs mt-1">영상을 생성하면 여기에 표시됩니다</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dbHistory.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group"
                      >
                        {/* 영상 썸네일 */}
                        <div className="relative aspect-video bg-gray-100 overflow-hidden">
                          <video
                            src={item.generatedVideoUrl}
                            className="w-full h-full object-cover"
                            muted
                            onLoadedData={(e) => {
                              const video = e.target as HTMLVideoElement;
                              video.currentTime = 1; // 1초 지점으로 이동하여 썸네일 생성
                            }}
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <Play className="w-8 h-8 text-white" />
                          </div>
                        </div>

                        {/* 영상 정보 */}
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1">
                              {item.title}
                            </h4>
                            <button
                              onClick={() => deleteHistoryItem(item.id)}
                              className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                              {item.model}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                              {item.size} ({item.resolution})
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                              {item.duration}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(item.createdAt).toLocaleDateString('ko-KR', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <button
                              onClick={() => loadHistoryItem(item)}
                              className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              불러오기
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
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