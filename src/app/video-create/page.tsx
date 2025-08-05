"use client";
import { useState, useEffect } from "react";
import Header from '../components/Header';

import {
  Download, X, RotateCcw, User, Palette, Ruler, Paperclip, ChevronDown, MoreVertical, Save, RefreshCw, Play, Pause, Volume2, Plus
} from 'lucide-react';

export default function VideoCreate() {
  const [userInput, setUserInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("kling");
  const [selectedSize, setSelectedSize] = useState("16:9");
  const [selectedDuration, setSelectedDuration] = useState("5초");
  const [loading, setLoading] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showDurationDropdown, setShowDurationDropdown] = useState(false);
  const [autoPrompt, setAutoPrompt] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const models = [
    { name: "kling", description: "고품질 영상 생성", image: "/images/models/kling.jpg" },
    { name: "Minimax", description: "빠른 영상 생성", image: "/images/models/minimax.jpg" },
    { name: "Runway", description: "프리미엄 영상 생성", image: "/images/models/runway.jpg" }
  ];

  const sizes = [
    { name: "16:9", description: "가로형 영상", width: 1920, height: 1080 },
    { name: "9:16", description: "세로형 영상", width: 1080, height: 1920 }
  ];

  const durations = [
    { name: "5초", description: "표준 영상", seconds: 5 },
    { name: "10초", description: "긴 영상", seconds: 10 }
  ];

  const getSelectedSize = () => {
    const selectedSizeObj = sizes.find(size => size.name === selectedSize);
    return selectedSizeObj || sizes[0];
  };

  const getSelectedDuration = () => {
    const selectedDurationObj = durations.find(duration => duration.name === selectedDuration);
    return selectedDurationObj || durations[0]; // durations[1]에서 durations[0]으로 변경
  };

  const getContainerStyle = () => {
    const size = getSelectedSize();
    const aspectRatio = size.width / size.height;
    
    // 컨테이너 크기를 고정 (가로형: 900x506, 세로형: 506x900)
    return {
      aspectRatio: aspectRatio,
      maxWidth: aspectRatio > 1 ? '900px' : '506px',
      maxHeight: aspectRatio > 1 ? '506px' : '900px',
      width: '100%',
      height: 'auto',
      minWidth: aspectRatio > 1 ? '700px' : '394px',
      minHeight: aspectRatio > 1 ? '394px' : '700px'
    };
  };

  const getInitialContainerStyle = () => {
    const size = getSelectedSize();
    const aspectRatio = size.width / size.height;
    
    // 초기 화면용 작은 크기 (가로형: 400x225, 세로형: 225x400)
    return {
      aspectRatio: aspectRatio,
      maxWidth: aspectRatio > 1 ? '400px' : '225px',
      maxHeight: aspectRatio > 1 ? '225px' : '400px',
      width: '100%',
      height: 'auto'
    };
  };

  const handleFileAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    // 한 장만 첨부 가능하도록 첫 번째 파일만 사용
    if (files.length > 0) {
      setAttachedFiles([files[0]]);
      
      // 자동 프롬프트가 켜져있을 때만 백그라운드에서 프롬프트 생성 (입력창에는 표시하지 않음)
      if (autoPrompt) {
        await generatePromptFromImage([files[0]], false);
      }
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    // 한 장만 첨부 가능하도록 첫 번째 파일만 사용
    if (files.length > 0) {
      setAttachedFiles([files[0]]);
      
      // 자동 프롬프트가 켜져있을 때만 백그라운드에서 프롬프트 생성 (입력창에는 표시하지 않음)
      if (autoPrompt) {
        await generatePromptFromImage([files[0]], false);
      }
    }
  };

  const generatePromptFromImage = async (imageFiles: File[], updateInput: boolean = true) => {
    try {
      if (imageFiles.length === 0) return;
      
      // 한 장의 이미지만 분석
      const imageFile = imageFiles[0];
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch('/api/image-analyze', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.prompt && updateInput) {
          setUserInput(data.prompt);
        }
        // 백그라운드에서 프롬프트 생성 완료 (입력창에는 표시하지 않음)
      }
    } catch (error) {
      console.error('이미지 분석 중 오류:', error);
      if (updateInput) {
        setUserInput('이 이미지를 기반으로 새로운 영상을 생성해주세요');
      }
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
    setIsPlaying(false);
  };

  const handleGenerate = async () => {
    if (!userInput.trim()) return;
    
    setLoading(true);
    setError(null);
    setGeneratedVideo(null);
    
    try {
      const selectedDurationObj = getSelectedDuration();
      const selectedSizeObj = getSelectedSize();
      const formData = new FormData();
      
      let finalPrompt = userInput;
      
      // 자동 프롬프트가 켜져있으면 OpenAI로 번역 및 최적화
      if (autoPrompt) {
        // 영상 제작에 최적화된 프롬프트 생성
        const enhancedPrompt = `${userInput}, cinematic video, smooth motion, high quality, professional lighting, dynamic camera movement, fluid animation, cinematic composition, movie-like quality, seamless transitions, realistic physics, natural movement, cinematic atmosphere, professional video production, high resolution, smooth frame rate, cinematic color grading, professional cinematography, dynamic storytelling, engaging visual narrative, cinematic depth of field, professional video editing, cinematic sound design, immersive experience, cinematic visual effects, professional video quality`;
        
        const optimizeResponse = await fetch("/api/optimize-prompt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            model: selectedModel
          }),
        });

        if (!optimizeResponse.ok) {
          throw new Error('프롬프트 최적화에 실패했습니다.');
        }

        const optimizeData = await optimizeResponse.json();
        finalPrompt = optimizeData.optimizedPrompt;
      }
      
      formData.append('prompt', finalPrompt);
      formData.append('duration', selectedDuration);
      formData.append('seconds', selectedDurationObj.seconds.toString());
      formData.append('model', selectedModel);
      formData.append('size', `${selectedSizeObj.width}:${selectedSizeObj.height}`);
      
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
    setShowDurationDropdown(false);
  };

  const handleSizeDropdown = () => {
    setShowSizeDropdown(!showSizeDropdown);
    setShowModelDropdown(false);
    setShowDurationDropdown(false);
  };

  const handleDurationDropdown = () => {
    setShowDurationDropdown(!showDurationDropdown);
    setShowModelDropdown(false);
    setShowSizeDropdown(false);
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value);
  };

  const handleAutoPromptChange = (checked: boolean) => {
    setAutoPrompt(checked);
  };

  const handleDurationChange = (durationName: string) => {
    setSelectedDuration(durationName);
    setShowDurationDropdown(false);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

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

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrompt}
                    onChange={(e) => handleAutoPromptChange(e.target.checked)}
                    className="w-5 h-5 text-white bg-black border-black rounded focus:ring-black checked:bg-black checked:border-black"
                    style={{
                      accentColor: 'black',
                      backgroundColor: autoPrompt ? 'black' : 'white',
                      borderColor: 'black'
                    }}
                  />
                  <span className="text-base text-gray-700 font-medium">자동 프롬프트</span>
                </label>

                <div className="relative">
                  <button
                    onClick={handleSizeDropdown}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm min-w-[120px]"
                  >
                    <span className="font-medium">{selectedSize}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  {showSizeDropdown && (
                    <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {sizes.map((size) => (
                        <button
                          key={size.name}
                          onClick={() => {
                            setSelectedSize(size.name);
                            setShowSizeDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{size.name}</span>
                            <span className="text-xs text-gray-500">{size.description}</span>
                          </div>
                          <div className="w-10 h-10 rounded-lg overflow-hidden">
                            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                              <Ruler className="w-6 h-6 text-gray-600" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={handleDurationDropdown}
                    disabled={generatedVideo !== null}
                    className={`flex items-center gap-2 px-3 py-2 border-2 border-gray-400 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-md min-w-[120px] hover:border-gray-500 hover:shadow-lg transition-all ${
                      generatedVideo !== null ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="font-medium text-gray-800">{selectedDuration}</span>
                    <ChevronDown className="w-4 h-4 text-gray-700" />
                  </button>
                  {showDurationDropdown && generatedVideo === null && (
                    <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {durations.map((duration) => (
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
                          placeholder="어떤 영상을 만들고 싶으신가요?"
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 