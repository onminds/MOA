"use client";
import { useState, useEffect } from "react";
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import {
  Download, X, RotateCcw, User, Palette, Ruler, Paperclip, ChevronDown, MoreVertical, Save, RefreshCw
} from 'lucide-react';
import Image from 'next/image';

export default function ImageCreate() {
  const [userInput, setUserInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("DALL-E 3");
  const [selectedStyle, setSelectedStyle] = useState("자동 스타일");
  const [selectedSize, setSelectedSize] = useState("1024x1024");
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [autoPrompt, setAutoPrompt] = useState(true);

  const models = [
    { name: "DALL-E 3", description: "가장 정확한 이미지 생성", image: "/images/models/dalle3.jpg" },
    { name: "Stable Diffusion XL", description: "고품질 이미지 생성", image: "/images/models/sdxl.jpg" },
    { name: "Kandinsky", description: "실사 스타일보다는 예술/추상화이미지", image: "/images/models/kandinsky.jpg" },
    { name: "Realistic Vision", description: "사실적인 이미지 생성", image: "/images/models/realistic-vision.jpg" }
  ];

  const styles = [
    { name: "자동 스타일", description: "AI가 자동으로 선택", image: null, promptSuffix: "" },
    { name: "실사화", description: "사진처럼 사실적인 스타일", image: "/images/styles/realistic.jpg", promptSuffix: ", realistic, high quality, detailed, photorealistic" },
    { name: "만화", description: "만화나 일러스트 스타일", image: "/images/styles/cartoon.jpg", promptSuffix: ", cartoon style, anime, illustration, colorful" },
    { name: "수채화", description: "부드러운 수채화 스타일", image: "/images/styles/watercolor.jpg", promptSuffix: ", watercolor painting, soft colors, artistic" },
    { name: "애니메이션", description: "3D 애니메이션 스타일", image: "/images/styles/animation.jpg", promptSuffix: ", 3D animation, CGI, Pixar style" },
    { name: "유화", description: "유화 그림 스타일", image: "/images/styles/oil-painting.jpg", promptSuffix: ", oil painting, textured, artistic, painterly" },
    { name: "3D", description: "3D 렌더링 스타일", image: "/images/styles/3d.jpg", promptSuffix: ", 3D render, digital art, clean" },
    { name: "미니멀리스트", description: "간단한 미니멀 스타일", image: "/images/styles/minimalist.jpg", promptSuffix: ", minimalist, simple, clean lines, geometric" },
    { name: "팝 아트", description: "팝 아트 스타일", image: "/images/styles/pop-art.jpg", promptSuffix: ", pop art, bold colors, graphic design, Andy Warhol style" }
  ];

  const sizes = [
    { name: "1024x1024", description: "정사각형 (1:1)", width: 1024, height: 1024 },
    { name: "1024x1792", description: "세로형 (9:16)", width: 1024, height: 1792 },
    { name: "1792x1024", description: "가로형 (16:9)", width: 1792, height: 1024 }
  ];

  const getSelectedSize = () => {
    const selectedSizeObj = sizes.find(size => size.name === selectedSize);
    return selectedSizeObj || sizes[0];
  };

  const getAspectRatio = () => {
    const size = getSelectedSize();
    return size.width / size.height;
  };

  const getContainerStyle = () => {
    const aspectRatio = getAspectRatio();
    
    if (aspectRatio > 1.5) {
      // 16:9 (가로형) - 원본 크기 그대로
      return {
        aspectRatio: aspectRatio,
        maxWidth: '800px',
        maxHeight: '450px',
        width: '100%',
        height: 'auto'
      };
    } else if (aspectRatio < 0.7) {
      // 9:16 (세로형) - 원본 크기 그대로
      return {
        aspectRatio: aspectRatio,
        maxWidth: '300px',
        maxHeight: '500px',
        width: '100%',
        height: 'auto'
      };
    } else {
      // 1:1 (정사각형) - 기존대로
      return {
        aspectRatio: aspectRatio,
        maxWidth: '500px',
        maxHeight: '500px',
        width: '100%',
        height: 'auto'
      };
    }
  };

  const handleFileAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachedFiles(prev => [...prev, ...files]);
    
    // 첫 번째 이미지가 첨부되면 자동으로 프롬프트 생성
    if (files.length > 0 && attachedFiles.length === 0) {
      await generatePromptFromImage(files[0]);
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
    setAttachedFiles(prev => [...prev, ...files]);
    
    // 첫 번째 이미지가 첨부되면 자동으로 프롬프트 생성
    if (files.length > 0 && attachedFiles.length === 0) {
      await generatePromptFromImage(files[0]);
    }
  };

  const generatePromptFromImage = async (imageFile: File) => {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch('/api/image-analyze', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.prompt) {
          setUserInput(data.prompt);
        }
      }
    } catch (error) {
      console.error('이미지 분석 중 오류:', error);
      setUserInput('이 이미지를 기반으로 새로운 이미지를 생성해주세요');
    }
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleImageMenuToggle = () => {
    setShowImageMenu(!showImageMenu);
  };

  const handleDownloadImage = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSaveImage = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleNewImage = () => {
    setGeneratedImage(null);
    setUserInput("");
    setAttachedFiles([]);
    setShowImageMenu(false);
  };

  const handleGenerate = async () => {
    if (!userInput.trim()) return;
    
    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    
    try {
      const selectedSizeObj = getSelectedSize();
      const formData = new FormData();
      
      // 스타일이 설정 가능한 모델들
      const styleEnabledModels = ["DALL-E 3", "Stable Diffusion XL", "Realistic Vision"];
      const isStyleEnabled = styleEnabledModels.includes(selectedModel);
      
      // 선택된 스타일의 프롬프트 접미사 가져오기
      const selectedStyleObj = styles.find(style => style.name === selectedStyle);
      const stylePrompt = isStyleEnabled && selectedStyleObj?.promptSuffix ? selectedStyleObj.promptSuffix : "";
      
      // 사용자 입력 + 스타일 프롬프트 결합
      const combinedPrompt = stylePrompt ? `${userInput}${stylePrompt}` : userInput;
      
      let finalPrompt = combinedPrompt;
      
      // 자동 프롬프트가 켜져있으면 OpenAI로 번역 및 최적화
      if (autoPrompt) {
        const optimizeResponse = await fetch("/api/optimize-prompt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: combinedPrompt,
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
      formData.append('style', selectedStyle);
      formData.append('size', selectedSize);
      formData.append('width', selectedSizeObj.width.toString());
      formData.append('height', selectedSizeObj.height.toString());
      formData.append('model', selectedModel);
      formData.append('ratio', getAspectRatio() > 1.5 ? "16:9" : getAspectRatio() < 0.7 ? "9:16" : "1:1");
      
      if (attachedFiles.length > 0) {
        attachedFiles.forEach(file => {
          formData.append('referenceImages', file);
        });
      }

      const res = await fetch("/api/image-generate", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error('이미지 생성에 실패했습니다.');
      }
      
      const data = await res.json();
      setGeneratedImage(data.url || null);
    } catch (err) {
      console.error('이미지 생성 에러:', err);
      
      if (err instanceof Error) {
        if (err.message.includes('billing') || err.message.includes('limit') || err.message.includes('400')) {
          setError('OpenAI API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.');
        } else {
          setError(err.message);
        }
      } else {
        setError("서버 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleModelDropdown = () => {
    setShowModelDropdown(!showModelDropdown);
    setShowStyleDropdown(false);
    setShowSizeDropdown(false);
  };

  const handleStyleDropdown = () => {
    setShowStyleDropdown(!showStyleDropdown);
    setShowModelDropdown(false);
    setShowSizeDropdown(false);
  };

  const handleSizeDropdown = () => {
    setShowSizeDropdown(!showSizeDropdown);
    setShowModelDropdown(false);
    setShowStyleDropdown(false);
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(e.target.value);
  };

  const handleAutoPromptChange = (checked: boolean) => {
    setAutoPrompt(checked);
  };

  const handleStyleChange = (styleName: string) => {
    setSelectedStyle(styleName);
    setShowStyleDropdown(false);
  };

  const handleSizeChange = (sizeName: string) => {
    setSelectedSize(sizeName);
    setShowSizeDropdown(false);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white">
        <div className="flex">
          <Sidebar currentPath="/image-create" />
          
          <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-8">
            {!loading && !generatedImage && (
              <div className="text-center mb-12">
                <h1 className="text-4xl font-semibold text-gray-800 mb-2">
                  이미지를 생성해드립니다!
                </h1>
              </div>
            )}

            <div className="mb-16">
              <div className="bg-white rounded-2xl flex items-center justify-center relative" style={getContainerStyle()}>
                {loading ? (
                  <div className="text-center w-full h-full flex flex-col items-center justify-center">
                    <div className="relative flex items-center justify-center">
                      <div className="text-black font-bold text-5xl z-10 relative">MOA</div>
                      <div className="absolute top-16 text-black text-lg font-medium z-10 text-center w-full whitespace-nowrap">AI가 영상 제작중</div>
                      <div className="absolute w-60 h-60 border-2 border-black border-t-transparent rounded-full animate-spin flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '2s'}}></div>
                      </div>
                    </div>
                  </div>
                ) : generatedImage ? (
                  <div className="text-center w-full h-full relative">
                    <div className="w-full h-full rounded-xl overflow-hidden" style={getContainerStyle()}>
                      <Image
                        src={generatedImage}
                        alt="생성된 이미지"
                        width={getSelectedSize().width}
                        height={getSelectedSize().height}
                        className="w-full h-full object-cover"
                      />
                      
                      <div className="absolute top-4 right-4 z-10 image-menu-container">
                        <button
                          onClick={handleImageMenuToggle}
                          className="p-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg hover:bg-white transition-all"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-700" />
                        </button>
                        
                        {showImageMenu && (
                          <div className="absolute right-0 top-12 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[160px] z-20">
                            <button
                              onClick={handleDownloadImage}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Download className="w-4 h-4" />
                              다운로드
                            </button>
                            <button
                              onClick={handleSaveImage}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <Save className="w-4 h-4" />
                              저장
                            </button>
                            <div className="border-t border-gray-200 my-1"></div>
                            <button
                              onClick={handleNewImage}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <RefreshCw className="w-4 h-4" />
                              새로 만들기
                            </button>
                          </div>
                        )}
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
                          <Image
                            src={selectedModelData.image}
                            alt={selectedModel}
                            width={512}
                            height={512}
                            className="w-full h-full object-cover"
                            style={{
                              imageRendering: 'crisp-edges'
                            }}
                            onError={(e) => {
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
                              <Image
                                src={model.image}
                                alt={model.name}
                                width={512}
                                height={512}
                                className="w-full h-full object-cover"
                                style={{
                                  imageRendering: 'crisp-edges'
                                }}
                                onError={(e) => {
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
                    className="w-5 h-5 text-white bg-black border-black rounded focus:ring-black checked:bg-black checked:border-black [&:checked]:bg-black [&:checked]:border-black"
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
                    onClick={handleStyleDropdown}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm min-w-[120px]"
                  >
                    <span className="font-medium">{selectedStyle}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  {showStyleDropdown && (
                    <div className="absolute bottom-full left-0 mb-1 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-4">
                      <div className="grid grid-cols-3 gap-3">
                        {styles.map((style) => (
                          <button
                            key={style.name}
                            onClick={() => handleStyleChange(style.name)}
                            className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                              selectedStyle === style.name 
                                ? 'border-blue-500 ring-2 ring-blue-200' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {/* 실제 이미지 표시 */}
                            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                              {style.name === "자동 스타일" ? (
                                <div className="w-12 h-12 bg-gradient-to-br from-green-200 to-blue-200 rounded-lg flex items-center justify-center">
                                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                  </svg>
                                </div>
                              ) : style.image ? (
                                <div className="w-full h-full p-0">
                                  <Image
                                    src={style.image}
                                    alt={style.name}
                                    width={80}
                                    height={80}
                                    className="w-full h-full object-cover"
                                    style={{ objectPosition: 'center 30%' }}
                                    onError={(e) => {
                                      // 이미지 로드 실패 시 기본 아이콘 표시
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const fallback = document.createElement('div');
                                        fallback.className = 'w-12 h-12 bg-gradient-to-br from-blue-200 to-purple-200 rounded-lg flex items-center justify-center';
                                        fallback.innerHTML = '<svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2M9 14l2-2 4 4m0 0l2-2m-2 2l-2-2"></path></svg>';
                                        parent.appendChild(fallback);
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-200 to-purple-200 rounded-lg flex items-center justify-center">
                                  <Palette className="w-6 h-6 text-gray-600" />
                                </div>
                              )}
                            </div>
                            
                            {/* 스타일 이름 오버레이 */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <div className="text-white text-xs font-medium text-center">
                                {style.name}
                              </div>
                            </div>
                            
                            {/* 선택 표시 */}
                            {selectedStyle === style.name && (
                              <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={handleSizeDropdown}
                    disabled={generatedImage !== null}
                    className={`flex items-center gap-2 px-3 py-2 border-2 border-gray-400 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-md min-w-[120px] hover:border-gray-500 hover:shadow-lg transition-all ${
                      generatedImage !== null ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="font-medium text-gray-800">{selectedSize}</span>
                    <ChevronDown className="w-4 h-4 text-gray-700" />
                  </button>
                  {showSizeDropdown && generatedImage === null && (
                    <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      {sizes.map((size) => (
                        <button
                          key={size.name}
                          onClick={() => handleSizeChange(size.name)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 flex flex-col"
                        >
                          <span className="font-medium text-gray-900">{size.name}</span>
                          <span className="text-xs text-gray-500">{size.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className={`relative bg-white border-2 border-gray-200 rounded-xl shadow-sm transition-all duration-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 ${attachedFiles.length > 0 ? 'pb-4' : ''}`}>
                      <input
                        type="text"
                        value={userInput}
                        onChange={handlePromptChange}
                        placeholder={isDragOver ? "이미지를 여기에 드롭하세요!" : "어떤 이미지를 만들고 싶으신가요?"}
                        className={`w-full px-4 py-3 pr-12 border-none rounded-t-xl bg-white focus:outline-none text-gray-900 shadow-none transition-all ${
                          isDragOver 
                            ? 'bg-blue-50' 
                            : ''
                        } ${attachedFiles.length > 0 ? 'rounded-b-none' : 'rounded-b-xl'}`}
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
                        <label className="cursor-pointer p-1 text-gray-500 hover:text-gray-700 transition-colors" title="파일 첨부">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileAttach}
                            multiple
                            className="hidden"
                          />
                          <Paperclip className="w-4 h-4" />
                        </label>
                      </div>
                      
                      {/* 첨부된 이미지들 - 입력창 안에 배치 */}
                      {attachedFiles.length > 0 && (
                        <div className="px-4 pt-3 flex items-start gap-3 flex-wrap">
                          {attachedFiles.map((file, index) => (
                            <div key={index} className="relative w-[128px] h-[128px] rounded-lg overflow-hidden shadow border border-gray-200 bg-white flex-shrink-0">
                              {file.type.startsWith('image/') ? (
                                <Image
                                  src={URL.createObjectURL(file)}
                                  alt={file.name}
                                  width={128}
                                  height={128}
                                  className="w-full h-full object-contain mx-auto"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.innerHTML = '<div class=\'w-full h-full flex items-center justify-center text-gray-500\'>이미지를 불러올 수 없습니다</div>';
                                    }
                                  }}
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                  <Paperclip className="w-8 h-8 text-gray-500" />
                                </div>
                              )}
                              <button
                                onClick={() => removeAttachedFile(index)}
                                className="absolute top-1 right-1 p-1 bg-white/80 rounded-full text-red-500 hover:text-red-700 shadow"
                                title="첨부 파일 제거"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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
                        <RotateCcw className="w-5 h-5" />
                        생성
                      </>
                    )}
                  </button>
                </div>
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