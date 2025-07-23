"use client";
import { useState, useEffect } from "react";
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import {
  Download, X, RotateCcw, User, Palette, Ruler, Paperclip, ChevronDown
} from 'lucide-react';
import Image from 'next/image';

export default function ImageCreate() {
  const [prompt, setPrompt] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("Mixture-of-Agents");
  const [autoPrompt, setAutoPrompt] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState("자동 스타일");
  const [selectedSize, setSelectedSize] = useState("자동 크기");
  const [selectedModel, setSelectedModel] = useState("DALL-E 3");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [userInput, setUserInput] = useState(""); // 사용자 원본 입력

  const models = [
    { name: "DALL-E 3", description: "가장 정확한 이미지 생성" },
    { name: "Midjourney", description: "예술적 스타일 이미지" },
    { name: "Stable Diffusion", description: "빠른 이미지 생성" }
  ];

  const styles = [
    { name: "자동 스타일", description: "AI가 자동으로 선택", image: "/images/styles/auto-style.jpg", promptSuffix: "" },
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
    { name: "자동 크기", description: "AI가 자동으로 선택", width: 1024, height: 1024 },
    { name: "1024x1024", description: "정사각형 (1:1)", width: 1024, height: 1024 },
    { name: "1024x1792", description: "세로형 (9:16)", width: 1024, height: 1792 },
    { name: "1792x1024", description: "가로형 (16:9)", width: 1792, height: 1024 }
  ];

  const enhancePrompt = (userPrompt: string) => {
    if (!autoPrompt) return userPrompt;
    
    // 기본적인 프롬프트 강화
    let enhancedPrompt = userPrompt;
    
    // 색상 관련 키워드가 없으면 추가
    if (!enhancedPrompt.includes('color') && !enhancedPrompt.includes('색') && !enhancedPrompt.includes('빨간') && !enhancedPrompt.includes('파란') && !enhancedPrompt.includes('노란') && !enhancedPrompt.includes('초록')) {
      enhancedPrompt += ', vibrant colors, high contrast';
    }
    
    // 품질 관련 키워드가 없으면 추가
    if (!enhancedPrompt.includes('quality') && !enhancedPrompt.includes('고품질') && !enhancedPrompt.includes('상세')) {
      enhancedPrompt += ', high quality, detailed';
    }
    
    // 조명 관련 키워드가 없으면 추가
    if (!enhancedPrompt.includes('light') && !enhancedPrompt.includes('조명') && !enhancedPrompt.includes('밝은') && !enhancedPrompt.includes('어두운')) {
      enhancedPrompt += ', well-lit, professional lighting';
    }
    
    // 구도 관련 키워드가 없으면 추가
    if (!enhancedPrompt.includes('composition') && !enhancedPrompt.includes('구도') && !enhancedPrompt.includes('전체') && !enhancedPrompt.includes('클로즈업')) {
      enhancedPrompt += ', balanced composition';
    }
    
    // 해상도 관련 키워드가 없으면 추가
    if (!enhancedPrompt.includes('resolution') && !enhancedPrompt.includes('해상도') && !enhancedPrompt.includes('4k') && !enhancedPrompt.includes('8k')) {
      enhancedPrompt += ', high resolution';
    }
    
    return enhancedPrompt;
  };

  const handleStyleChange = (styleName: string) => {
    setSelectedStyle(styleName);
    setShowStyleDropdown(false);
    
    // 선택된 스타일에 따라 프롬프트 업데이트
    const selectedStyleObj = styles.find(style => style.name === styleName);
    if (selectedStyleObj && selectedStyleObj.promptSuffix) {
      // 기존 프롬프트에서 스타일 접미사 제거
      let cleanPrompt = userInput;
      styles.forEach(style => {
        if (style.promptSuffix) {
          cleanPrompt = cleanPrompt.replace(style.promptSuffix, '');
        }
      });
      
      // 새로운 스타일 접미사 추가 (사용자 입력창에는 표시하지 않음)
      setPrompt(cleanPrompt.trim() + selectedStyleObj.promptSuffix);
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setUserInput(inputValue); // 사용자 원본 입력 업데이트
    
    // 스타일 접미사가 있으면 프롬프트에 추가
    const selectedStyleObj = styles.find(style => style.name === selectedStyle);
    if (selectedStyleObj && selectedStyleObj.promptSuffix) {
      setPrompt(inputValue + selectedStyleObj.promptSuffix);
    } else {
      setPrompt(inputValue);
    }
  };

  const handleAutoPromptChange = (checked: boolean) => {
    setAutoPrompt(checked);
    // 자동 프롬프트 상태 변경 시에는 사용자 입력창은 그대로 유지
  };

  const handleSizeChange = (sizeName: string) => {
    setSelectedSize(sizeName);
    setShowSizeDropdown(false);
  };

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
    
    // 비율에 따라 최대 크기 조정
    if (aspectRatio > 1.5) {
      // 16:9 (가로형) - 원본 크기 그대로
      return {
        aspectRatio: aspectRatio,
        maxWidth: '800px',
        maxHeight: '1024px',
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

  const handleFileAttach = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
  };

  const handleGenerate = async () => {
    if (!userInput.trim()) return;
    
    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    
    try {
      const selectedSizeObj = getSelectedSize();
      const formData = new FormData();
      
      // 자동 프롬프트가 켜져있으면 강화된 프롬프트 사용
      const finalPrompt = autoPrompt ? enhancePrompt(prompt) : prompt;
      formData.append('prompt', finalPrompt);
      
      formData.append('agent', selectedAgent);
      formData.append('autoPrompt', autoPrompt.toString());
      formData.append('style', selectedStyle);
      formData.append('size', selectedSize);
      formData.append('width', selectedSizeObj.width.toString());
      formData.append('height', selectedSizeObj.height.toString());
      formData.append('model', selectedModel);
      
      if (attachedFile) {
        formData.append('referenceImage', attachedFile);
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
      
      // OpenAI API 결제 한도 에러 처리
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

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white">
        <div className="flex">
          {/* 공통 사이드바 */}
          <Sidebar currentPath="/image-create" />
          
          {/* 메인 콘텐츠 */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-8">
            {/* 상단 인사말 */}
            {!loading && !generatedImage && (
              <div className="text-center mb-12">
                <h1 className="text-4xl font-semibold text-gray-800 mb-2">
                  이미지를 생성해드립니다!
                </h1>
              </div>
            )}

            {/* 중앙 예시 이미지 */}
            <div className="mb-16">
              <div className="bg-white rounded-2xl flex items-center justify-center relative" style={getContainerStyle()}>
                {loading ? (
                  <div className="text-center w-full h-full flex flex-col items-center justify-center">
                    {/* 중앙 MOA 아이콘 */}
                    <div className="relative flex items-center justify-center">
                      {/* 메인 MOA 텍스트 */}
                      <div className="text-black font-bold text-5xl z-10 relative">MOA</div>
                      
                      {/* AI가 영상 제작중 텍스트 */}
                      <div className="absolute top-16 text-black text-lg font-medium z-10 text-center w-full whitespace-nowrap">AI가 영상 제작중</div>
                      
                      {/* 회전하는 링들 */}
                      <div className="absolute w-60 h-60 border-2 border-black border-t-transparent rounded-full animate-spin flex items-center justify-center">
                        <div className="w-48 h-48 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '2s'}}></div>
                      </div>
                    </div>
                  </div>
                ) : generatedImage ? (
                  <div className="text-center w-full h-full">
                    <div className="w-full h-full rounded-xl overflow-hidden" style={getContainerStyle()}>
                      <Image
                        src={generatedImage}
                        alt="생성된 이미지"
                        width={getSelectedSize().width}
                        height={getSelectedSize().height}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-4">
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedImage;
                          link.download = 'generated-image.png';
                          link.click();
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        <Download className="w-4 h-4" />
                        다운로드
                      </button>
                      <button
                        onClick={() => {
                          setGeneratedImage(null);
                          setUserInput("");
                          setPrompt("");
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                      >
                        <RotateCcw className="w-4 h-4" />
                        새로 만들기
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center w-full h-full flex items-center justify-center">
                  </div>
                )}
              </div>
            </div>

            {/* 하단 입력 영역 */}
            <div className="w-full max-w-4xl mt-8">
              {/* 컨트롤 버튼들 */}
              <div className="flex items-center gap-4 mb-6 justify-center h-12">
                {/* 모델 선택 드롭업 */}
                <div className="relative">
                  <button
                    onClick={handleModelDropdown}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm min-w-[140px]"
                  >
                    <span className="font-medium">{selectedModel}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
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
                          <div className="w-8 h-8 rounded-lg overflow-hidden">
                            {model.name === "DALL-E 3" && (
                              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">D3</span>
                              </div>
                            )}
                            {model.name === "Midjourney" && (
                              <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">MJ</span>
                              </div>
                            )}
                            {model.name === "Stable Diffusion" && (
                              <div className="w-full h-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">SD</span>
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

                {/* 스타일 선택 드롭업 */}
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

                {/* 크기 선택 드롭업 */}
                <div className="relative">
                  <button
                    onClick={handleSizeDropdown}
                    disabled={generatedImage !== null}
                    className={`flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm min-w-[120px] ${
                      generatedImage !== null ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="font-medium">{selectedSize}</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  {showSizeDropdown && generatedImage === null && (
                    <div className="absolute bottom-full left-0 mb-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
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

              {/* 입력 필드와 생성 버튼 */}
              <div className="flex items-center gap-4 max-w-3xl mx-auto h-16">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={userInput}
                    onChange={handlePromptChange}
                    placeholder="어떤 이미지를 만들고 싶으신가요?"
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-gray-900"
                    disabled={loading}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !loading && userInput.trim()) {
                        handleGenerate();
                      }
                    }}
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    {attachedFile && (
                      <button
                        onClick={removeAttachedFile}
                        className="p-1 text-red-500 hover:text-red-700 transition-colors"
                        title="첨부 파일 제거"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <label className="cursor-pointer p-1 text-gray-500 hover:text-gray-700 transition-colors" title="파일 첨부">
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
                <button
                  onClick={() => {
                    if (!userInput.trim()) {
                      // 입력 문구가 없으면 입력창에 포커스
                      const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
                      if (inputElement) {
                        inputElement.focus();
                      }
                    } else {
                      // 입력 문구가 있으면 생성 실행
                      handleGenerate();
                    }
                  }}
                  disabled={loading}
                  className={`px-6 py-3 rounded-xl transition-colors flex items-center gap-2 border-2 shadow-sm text-base font-medium ${
                    !userInput.trim() 
                      ? 'bg-gray-300 text-gray-500 border-gray-300 cursor-pointer' 
                      : loading 
                        ? 'bg-gray-400 text-white border-gray-400 cursor-not-allowed'
                        : 'bg-black text-white border-black hover:bg-gray-800 hover:border-gray-800'
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

              {/* 첨부된 파일 표시 */}
              {attachedFile && (
                <div className="mt-4 max-w-3xl mx-auto">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Paperclip className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-800 font-medium">{attachedFile.name}</span>
                    <span className="text-xs text-blue-600">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
              )}

              {/* 에러 메시지 */}
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