"use client";
import { useState, useEffect } from "react";
import { Download, Save, RefreshCw } from 'lucide-react';
import Image from 'next/image';

interface RemixModeProps {
  generatedImage: string;
  remixCategory: 'background' | 'subject' | 'other' | 'remove-background' | 'inpaint' | 'recolor' | 'outpaint' | null;
  setRemixCategory: (category: 'background' | 'subject' | 'other' | 'remove-background' | 'inpaint' | 'recolor' | 'outpaint' | null) => void;
  remixPreview: string | null;
  isPreviewMode: boolean;
  showBeforeAfter: boolean;
  setShowBeforeAfter: (show: boolean) => void;
  isRemixGenerating: boolean;
  remixPrompt: string;
  setRemixPrompt: (prompt: string) => void;
  backgroundPrompt: string;
  setBackgroundPrompt: (prompt: string) => void;
  searchPrompt: string;
  setSearchPrompt: (prompt: string) => void;
  selectPrompt: string;
  setSelectPrompt: (prompt: string) => void;
  colorPrompt: string;
  setColorPrompt: (prompt: string) => void;
  outpaintDirections: string[];
  setOutpaintDirections: (directions: string[]) => void;
  outpaintPixels: number;
  setOutpaintPixels: (pixels: number) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  showAdvancedOptions: boolean;
  setShowAdvancedOptions: (show: boolean) => void;
  imageUpdateKey: number;
  getSelectedSize: () => { width: number; height: number };
  getContainerStyle: () => any;
  handleRemixGenerate: (category: 'background' | 'subject' | 'other' | 'remove-background' | 'inpaint' | 'recolor' | 'outpaint') => void;
  handleDownloadImage: () => void;
  handleSaveImage: () => void;
  handleNewImage: () => void;
  handleExitRemixMode: () => void;
  resetEditingState?: React.MutableRefObject<(() => void) | null>; // 편집 상태 초기화 함수 참조
  startDrawing: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  stopDrawing: () => void;
  draw: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  clearMask: () => void;
  toggleOutpaintDirection: (direction: string) => void;
  setGeneratedImage: (image: string) => void; // 추가: generatedImage 설정 함수
  setRemixPreview: (preview: string | null) => void; // 추가: remixPreview 설정 함수
  setIsPreviewMode: (mode: boolean) => void; // 추가: isPreviewMode 설정 함수
}

export default function RemixMode({
  generatedImage,
  remixCategory,
  setRemixCategory,
  remixPreview,
  isPreviewMode,
  showBeforeAfter,
  setShowBeforeAfter,
  isRemixGenerating,
  remixPrompt,
  setRemixPrompt,
  backgroundPrompt,
  setBackgroundPrompt,
  searchPrompt,
  setSearchPrompt,
  selectPrompt,
  setSelectPrompt,
  colorPrompt,
  setColorPrompt,
  outpaintDirections,
  setOutpaintDirections,
  outpaintPixels,
  setOutpaintPixels,
  brushSize,
  setBrushSize,
  showAdvancedOptions,
  setShowAdvancedOptions,
  imageUpdateKey,
  getSelectedSize,
  getContainerStyle,
  handleRemixGenerate,
  handleDownloadImage,
  handleSaveImage,
  handleNewImage,
  handleExitRemixMode,
  resetEditingState,
  startDrawing,
  stopDrawing,
  draw,
  clearMask,
  toggleOutpaintDirection,
  setGeneratedImage,
  setRemixPreview,
  setIsPreviewMode
}: RemixModeProps) {
  // 원본 이미지를 추적하는 상태 (Before/After 토글용)
  const [originalImage, setOriginalImage] = useState<string>(generatedImage);
  // 편집이 시작되었는지 추적하는 상태
  const [hasStartedEditing, setHasStartedEditing] = useState<boolean>(false);

  // generatedImage가 변경될 때 원본 이미지 업데이트 (편집이 시작되지 않았을 때만)
  useEffect(() => {
    if (!hasStartedEditing) {
      setOriginalImage(generatedImage);
    }
  }, [generatedImage, hasStartedEditing]);

  // remixPreview가 생성되면 편집이 시작된 것으로 표시
  useEffect(() => {
    if (remixPreview && !hasStartedEditing) {
      setHasStartedEditing(true);
    }
  }, [remixPreview, hasStartedEditing]);

  // 편집 상태 초기화 함수
  const resetLocalEditingState = () => {
    setHasStartedEditing(false);
    setOriginalImage(generatedImage);
  };

  // 외부에서 호출할 수 있도록 resetEditingState가 제공되면 등록
  useEffect(() => {
    if (resetEditingState) {
      // 현재 컴포넌트의 리셋 함수를 외부에 제공
      resetEditingState.current = resetLocalEditingState;
    }
  }, [resetEditingState, generatedImage]);

  // 카테고리 변경 시 현재 편집된 이미지를 새로운 원본으로 설정하는 함수
  const handleCategoryChange = (newCategory: 'background' | 'subject' | 'other' | 'remove-background' | 'inpaint' | 'recolor' | 'outpaint') => {
    // 현재 편집된 이미지가 있으면 새로운 원본으로 설정
    if (remixPreview && isPreviewMode) {
      setGeneratedImage(remixPreview);
      // 원본 이미지는 변경하지 않음 - Before/After 토글을 위해 최초 원본 유지
      // setOriginalImage는 호출하지 않음
    }
    
    // 카테고리 변경
    setRemixCategory(newCategory);
    
    // 편집된 이미지가 있었다면 미리보기 상태를 유지하되, 새로운 편집을 위해 준비
    if (remixPreview && isPreviewMode) {
      // Before/After 상태는 유지하되, 새로운 편집을 위해 After 상태로 설정
      setShowBeforeAfter(true);
      // remixPreview는 유지하여 Before/After 토글이 작동하도록 함
    } else {
      // 편집된 이미지가 없었다면 초기화
      setRemixPreview(null);
      setIsPreviewMode(false);
      setShowBeforeAfter(false);
    }
    
    // 입력 필드들 초기화
    setRemixPrompt("");
    setBackgroundPrompt("");
    setSearchPrompt("");
    setSelectPrompt("");
    setColorPrompt("");
    
    // 영역 편집으로 변경될 때 캔버스 초기화
    if (newCategory === 'inpaint') {
      // 약간의 지연 후 캔버스 초기화 (컴포넌트 렌더링 완료 후)
      setTimeout(() => {
        const canvas = document.querySelector('canvas[class*="cursor-crosshair"]') as HTMLCanvasElement;
        if (canvas) {
          // 캔버스 초기화 상태 리셋
          delete canvas.dataset.initialized;
          console.log('영역 편집 캔버스 초기화 완료');
        }
      }, 100);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      {/* 최상단 제목 */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {remixCategory === 'background' && '배경을 변경해보세요!'}
          {remixCategory === 'subject' && '피사체를 변경해보세요!'}
          {remixCategory === 'other' && '이미지를 전체적으로 편집해보세요!'}
          {remixCategory === 'remove-background' && '배경을 제거해보세요!'}
          {remixCategory === 'inpaint' && '영역을 선택하여 편집해보세요!'}
          {remixCategory === 'recolor' && '객체의 색상을 변경해보세요!'}
          {remixCategory === 'outpaint' && '이미지를 확장해보세요!'}
          {!remixCategory && '이미지를 수정해보세요!'}
        </h1>
        <p className="text-gray-600 text-lg">
          {remixCategory === 'background' && '새로운 배경으로 이미지를 완전히 바꿔보세요'}
          {remixCategory === 'subject' && '기존 객체를 새로운 객체로 교체해보세요'}
          {remixCategory === 'other' && '이미지 전체를 원하는 대로 수정해보세요'}
          {remixCategory === 'remove-background' && '배경을 제거하여 투명 배경으로 만들어보세요'}
          {remixCategory === 'inpaint' && '특정 영역만 선택하여 세밀하게 편집해보세요'}
          {remixCategory === 'recolor' && '특정 객체의 색상을 원하는 색상으로 변경해보세요'}
          {remixCategory === 'outpaint' && '이미지 경계를 확장하여 더 넓은 화면을 만들어보세요'}
          {!remixCategory && '다양한 편집 도구로 이미지를 원하는 대로 수정하세요'}
        </p>
      </div>
      
      {/* 상단 리믹스 카테고리 네비게이션 */}
      <div className="flex items-center justify-center">
        {/* 데스크톱/태블릿 버전 - 아이콘과 텍스트 */}
        <div className="hidden md:flex items-center gap-2 bg-gray-900 rounded-lg shadow-sm border border-gray-700 p-1">
          <button
            onClick={() => handleCategoryChange('background')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
              remixCategory === 'background'
                ? 'bg-black text-white shadow-sm'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <span className="hidden lg:inline">배경 변경</span>
          </button>
          
          <button
            onClick={() => handleCategoryChange('subject')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
              remixCategory === 'subject'
                ? 'bg-black text-white shadow-sm'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            <span className="hidden lg:inline">피사체 변경</span>
          </button>
          
          <button
            onClick={() => handleCategoryChange('other')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
              remixCategory === 'other'
                ? 'bg-black text-white shadow-sm'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            <span className="hidden lg:inline">전체 편집</span>
          </button>
          
          <button
            onClick={() => handleCategoryChange('remove-background')}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
              remixCategory === 'remove-background'
                ? 'bg-black text-white shadow-sm'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span className="hidden lg:inline">배경 제거</span>
          </button>
          
          {/* 고급 기능 드롭다운 */}
          <div className="relative">
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                showAdvancedOptions
                  ? 'bg-black text-white shadow-sm'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="hidden lg:inline">고급 기능</span>
              <svg className={`w-3 h-3 transition-transform duration-200 ${showAdvancedOptions ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* 고급 기능 오른쪽 메뉴 */}
            {showAdvancedOptions && (
              <div className="absolute top-0 left-full ml-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50 min-w-[200px]">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      handleCategoryChange('inpaint');
                      setShowAdvancedOptions(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-md transition-colors ${
                      remixCategory === 'inpaint'
                        ? 'bg-gray-800 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                      </svg>
                      <div>
                        <div className="font-medium text-sm">영역 편집</div>
                        <div className="text-xs text-gray-400">영역만 선택하여 편집</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      handleCategoryChange('recolor');
                      setShowAdvancedOptions(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-md transition-colors ${
                      remixCategory === 'recolor'
                        ? 'bg-gray-800 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3H5a2 2 0 00-2 2v12a4 4 0 004 4h2a2 2 0 002-2V6a2 2 0 00-2-2M9 14l2-2 4 4m0 0l2-2m-2 2l-2-2"></path>
                      </svg>
                      <div>
                        <div className="font-medium text-sm">색상 변경</div>
                        <div className="text-xs text-gray-400">객체의 색상을 변경</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                        // 개발중 - 클릭 비활성화
                        return;
                      }}
                    className="w-full px-3 py-2 text-left rounded-md transition-colors opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                      </svg>
                      <div>
                        <div className="font-medium text-sm">이미지 확장</div>
                        <div className="text-xs text-gray-400">이미지 경계를 확장</div>
                        <div className="text-xs text-yellow-400 mt-1">🚧 개발중</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 모바일 버전 - 드롭다운 메뉴 */}
        <div className="md:hidden w-full max-w-xs">
          <div className="relative">
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg shadow-sm border border-gray-700 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  {remixCategory === 'background' && (
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  )}
                  {remixCategory === 'subject' && (
                    <>
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </>
                  )}
                  {remixCategory === 'other' && (
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  )}
                  {remixCategory === 'remove-background' && (
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  )}
                  {remixCategory === 'inpaint' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  )}
                  {remixCategory === 'recolor' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3H5a2 2 0 00-2 2v12a4 4 0 004 4h2a2 2 0 002-2V6a2 2 0 00-2-2M9 14l2-2 4 4m0 0l2-2m-2 2l-2-2" />
                  )}
                  {remixCategory === 'outpaint' && (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                  )}
                  {!remixCategory && (
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  )}
                </svg>
                <span className="font-medium">
                  {remixCategory === 'background' && '배경 변경'}
                  {remixCategory === 'subject' && '피사체 변경'}
                  {remixCategory === 'other' && '전체 편집'}
                  {remixCategory === 'remove-background' && '배경 제거'}
                  {remixCategory === 'inpaint' && '영역 편집'}
                  {remixCategory === 'recolor' && '색상 변경'}
                  {remixCategory === 'outpaint' && '이미지 확장'}
                  {!remixCategory && '편집 도구 선택'}
                </span>
              </div>
              <svg className={`w-4 h-4 transition-transform duration-200 ${showAdvancedOptions ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* 모바일 드롭다운 메뉴 */}
            {showAdvancedOptions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      handleCategoryChange('background');
                      setShowAdvancedOptions(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-md transition-colors flex items-center gap-3 ${
                      remixCategory === 'background'
                        ? 'bg-gray-800 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    <span>배경 변경</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      handleCategoryChange('subject');
                      setShowAdvancedOptions(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-md transition-colors flex items-center gap-3 ${
                      remixCategory === 'subject'
                        ? 'bg-gray-800 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    <span>피사체 변경</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      handleCategoryChange('other');
                      setShowAdvancedOptions(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-md transition-colors flex items-center gap-3 ${
                      remixCategory === 'other'
                        ? 'bg-gray-800 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    <span>전체 편집</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      handleCategoryChange('remove-background');
                      setShowAdvancedOptions(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-md transition-colors flex items-center gap-3 ${
                      remixCategory === 'remove-background'
                        ? 'bg-gray-800 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>배경 제거</span>
                  </button>
                  
                  <div className="border-t border-gray-700 my-2"></div>
                  
                  <button
                    onClick={() => {
                      handleCategoryChange('inpaint');
                      setShowAdvancedOptions(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-md transition-colors flex items-center gap-3 ${
                      remixCategory === 'inpaint'
                        ? 'bg-gray-800 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
                    </svg>
                    <span>영역 편집</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      handleCategoryChange('recolor');
                      setShowAdvancedOptions(false);
                    }}
                    className={`w-full px-3 py-2 text-left rounded-md transition-colors flex items-center gap-3 ${
                      remixCategory === 'recolor'
                        ? 'bg-gray-800 text-white'
                        : 'hover:bg-gray-800 text-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3H5a2 2 0 00-2 2v12a4 4 0 004 4h2a2 2 0 002-2V6a2 2 0 00-2-2M9 14l2-2 4 4m0 0l2-2m-2 2l-2-2" />
                    </svg>
                    <span>색상 변경</span>
                  </button>
                  
                  <button
                    onClick={() => {
                        // 개발중 - 클릭 비활성화
                        return;
                      }}
                    className="w-full px-3 py-2 text-left rounded-md transition-colors opacity-50 cursor-not-allowed flex items-center gap-3"
                    disabled
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                    </svg>
                    <span>이미지 확장 🚧</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 중앙 이미지 영역 */}
      <div className="flex justify-center items-center">
        <div className="relative flex items-center gap-12">
          {/* 왼쪽 돌아가기 버튼 */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleExitRemixMode}
              className="group relative p-3 bg-gradient-to-r from-gray-800 to-gray-900 text-gray-200 rounded-full hover:from-gray-700 hover:to-gray-800 transition-all duration-300 flex items-center justify-center font-medium border border-gray-600 hover:border-gray-500 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <div className="relative">
                <svg className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <div className="absolute inset-0 bg-white/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>
          
          {/* 이미지 영역 */}
          <div className="bg-gray-100 rounded-lg flex items-center justify-center relative group shadow-sm border border-gray-300" style={getContainerStyle()}>
            {(() => {
              console.log('이미지 표시 조건 확인:', {
                remixPreview: !!remixPreview,
                isPreviewMode,
                showBeforeAfter,
                remixPreviewLength: remixPreview?.length,
                imageUpdateKey
              });
              
              return remixPreview && isPreviewMode ? (
                <div className="w-full h-full rounded-lg overflow-hidden relative">
                  <Image
                    key={`remix-preview-${imageUpdateKey}`}
                    src={showBeforeAfter ? remixPreview : originalImage}
                    alt={showBeforeAfter ? "편집된 이미지" : "편집 전 이미지"}
                    width={getSelectedSize().width}
                    height={getSelectedSize().height}
                    className="w-full h-full object-cover"
                    priority
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-full h-full rounded-lg overflow-hidden relative">
                  <Image
                    key={`original-image-${imageUpdateKey}`}
                    src={generatedImage}
                    alt="생성된 이미지"
                    width={getSelectedSize().width}
                    height={getSelectedSize().height}
                    className="w-full h-full object-cover"
                    priority
                    unoptimized
                  />
                  {/* inpaint 모드일 때 마스크 오버레이 */}
                  {remixCategory === 'inpaint' && (
                    <canvas
                      ref={(canvas) => {
                        if (canvas && !canvas.dataset.initialized) {
                          const selectedSize = getSelectedSize();
                          canvas.width = selectedSize.width;
                          canvas.height = selectedSize.height;
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            // 완전히 투명하게 초기화
                            ctx.fillStyle = 'rgba(0, 0, 0, 0)';
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                          }
                          canvas.dataset.initialized = 'true';
                        }
                      }}
                      onMouseDown={startDrawing}
                      onMouseUp={stopDrawing}
                      onMouseMove={draw}
                      onMouseLeave={stopDrawing}
                      className="absolute inset-0 cursor-crosshair z-20"
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'block'
                      }}
                    />
                  )}
                </div>
              );
            })()}
          </div>
          
          {/* 오른쪽 버튼들 - 리믹스 모드에서만 표시 */}
          <div className="flex flex-col gap-3 relative">
            {/* 전후 비교 토글 */}
            <div className="text-center mb-5 -mt-40">
              {remixPreview ? (
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  showBeforeAfter ? 'text-black' : 'text-black'
                }`}>
                  {showBeforeAfter ? 'After' : 'Before'}
                </span>
              ) : (
                <span className="text-sm text-gray-500">
                  Before
                </span>
              )}
            </div>
            <div className="flex justify-center -mt-6">
              <button
                onClick={() => setShowBeforeAfter(!showBeforeAfter)}
                disabled={!remixPreview}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                  showBeforeAfter ? 'bg-black' : 'bg-gray-400'
                } ${!remixPreview ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
                  showBeforeAfter ? 'left-6' : 'left-0.5'
                }`}></div>
              </button>
            </div>
            
            <div className="relative group/button">
              <button
                onClick={handleDownloadImage}
                className="p-3 bg-black rounded-full hover:bg-gray-800 transition-all duration-200 shadow-md border border-gray-500"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
              <div className="absolute left-full ml-2 -mt-10 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover/button:opacity-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                이미지 다운로드
              </div>
            </div>
            
            <div className="relative group/button">
              <button
                onClick={() => {
                  // 개발중 - 클릭 비활성화
                  return;
                }}
                className="p-3 bg-gray-400 rounded-full opacity-50 cursor-not-allowed transition-all duration-200 shadow-md border border-gray-300"
                disabled
              >
                <Save className="w-5 h-5 text-gray-600" />
              </button>
              <div className="absolute left-full ml-2 -mt-10 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover/button:opacity-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                🚧 개발중
              </div>
            </div>
            
            <div className="relative group/button">
              <button
                onClick={handleNewImage}
                className="p-3 bg-black rounded-full hover:bg-gray-800 transition-all duration-200 shadow-md border border-gray-500"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
              <div className="absolute left-full ml-2 -mt-10 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover/button:opacity-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                새로 만들기
              </div>
            </div>
            
            {/* 브러시 크기 조정 - 새로 만들기 버튼 아래 (absolute로 레이아웃 영향 없음) */}
            {remixCategory === 'inpaint' && (
              <div className="absolute top-full left-0 mt-7 -ml-9">
                <div className="text-xs text-gray-600 mb-2 text-center">브러시 크기</div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-black [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer"
                    />
                    <span className="text-sm font-medium text-gray-700 w-8 text-center">{brushSize}</span>
                  </div>
                  <button
                    onClick={clearMask}
                    className="px-2 py-1 text-xs bg-black text-white rounded hover:bg-gray-800 transition-colors"
                  >
                    초기화
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 하단 프롬프트 입력 영역 */}
      <div className="max-w-4xl mx-auto">
        {/* 카테고리별 입력 필드들 */}
        <div className="space-y-6">
          {/* 배경 변경 입력 */}
          {remixCategory === 'background' && (
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    새로운 배경 프롬프트
                  </label>
                  <div className="relative group">
                    <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                      <span className="text-xs font-bold text-gray-600">?</span>
                    </div>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg z-10">
                      이미지의 배경을 새로운 배경으로 변경합니다
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  value={backgroundPrompt}
                  onChange={(e) => setBackgroundPrompt(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && backgroundPrompt.trim() && !isRemixGenerating) {
                      e.preventDefault();
                      handleRemixGenerate('background');
                    }
                  }}
                  placeholder="예: 산 풍경, 바다 파도, 도시 스카이라인, 숲길... (한국어/영어 모두 가능)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                />
              </div>
              <button
                onClick={() => handleRemixGenerate('background')}
                disabled={!backgroundPrompt.trim() || isRemixGenerating}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                  !backgroundPrompt.trim() || isRemixGenerating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }`}
              >
                {isRemixGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    편집 중...
                  </div>
                ) : (
                  '배경 편집 생성'
                )}
              </button>
            </div>
          )}

          {/* 피사체 변경 입력 */}
          {remixCategory === 'subject' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      변경할 객체 지정
                    </label>
                    <div className="relative group">
                      <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                        <span className="text-xs font-bold text-gray-600">?</span>
                      </div>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg z-10">
                        이미지에서 변경하고 싶은 객체를 지정합니다
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={searchPrompt}
                    onChange={(e) => setSearchPrompt(e.target.value)}
                    placeholder="예: 사람, 자동차, 강아지..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      새로운 피사체 프롬프트
                    </label>
                    <div className="relative group">
                      <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                        <span className="text-xs font-bold text-gray-600">?</span>
                      </div>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg z-10">
                        지정한 객체를 새로운 객체로 변경합니다
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  <textarea
                    value={remixPrompt}
                    onChange={(e) => setRemixPrompt(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && remixPrompt.trim() && !isRemixGenerating) {
                        e.preventDefault();
                        handleRemixGenerate('subject');
                      }
                    }}
                    placeholder="새로운 피사체를 설명해주세요... (예: 고양이, 자동차, 강아지)"
                    className="w-full h-20 px-4 py-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  />
                </div>
                <button
                  onClick={() => handleRemixGenerate('subject')}
                  disabled={!remixPrompt.trim() || isRemixGenerating}
                  className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                    !remixPrompt.trim() || isRemixGenerating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  }`}
                >
                  {isRemixGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      편집 중...
                    </div>
                  ) : (
                    '피사체 편집 생성'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 전체 편집 입력 */}
          {remixCategory === 'other' && (
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    편집 프롬프트
                  </label>
                  <div className="relative group">
                    <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                      <span className="text-xs font-bold text-gray-600">?</span>
                    </div>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg z-10">
                      이미지 전체를 편집하는 프롬프트를 입력합니다
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  value={remixPrompt}
                  onChange={(e) => setRemixPrompt(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && remixPrompt.trim() && !isRemixGenerating) {
                      e.preventDefault();
                      handleRemixGenerate('other');
                    }
                  }}
                  placeholder="이미지를 어떻게 수정하고 싶으신가요? (예: 더 밝게 만들기, 구름 추가하기)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                />
              </div>
              <button
                onClick={() => handleRemixGenerate('other')}
                disabled={!remixPrompt.trim() || isRemixGenerating}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                  !remixPrompt.trim() || isRemixGenerating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }`}
              >
                {isRemixGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    편집 중...
                  </div>
                ) : (
                  '전체 편집 생성'
                )}
              </button>
            </div>
          )}

          {/* 배경 제거는 버튼만 */}
          {remixCategory === 'remove-background' && (
            <div className="flex justify-center">
              <button
                onClick={() => handleRemixGenerate('remove-background')}
                disabled={isRemixGenerating}
                className={`px-8 py-4 rounded-md font-medium transition-all duration-200 ${
                  isRemixGenerating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }`}
              >
                {isRemixGenerating ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    편집 중...
                  </div>
                ) : (
                  '배경 제거 실행'
                )}
              </button>
            </div>
          )}

          {/* 영역 편집 (Inpaint) 입력 */}
          {remixCategory === 'inpaint' && (
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    편집 프롬프트
                  </label>
                  <div className="relative group">
                    <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                      <span className="text-xs font-bold text-gray-600">?</span>
                    </div>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg z-10">
                      선택한 영역에 들어갈 내용을 설명합니다
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  value={remixPrompt}
                  onChange={(e) => setRemixPrompt(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && remixPrompt.trim() && !isRemixGenerating) {
                      e.preventDefault();
                      handleRemixGenerate('inpaint');
                    }
                  }}
                  placeholder="선택한 영역에 들어갈 내용을 설명해주세요... (예: 꽃, 나무, 구름)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                />
              </div>
              <button
                onClick={() => handleRemixGenerate('inpaint')}
                disabled={!remixPrompt.trim() || isRemixGenerating}
                className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                  !remixPrompt.trim() || isRemixGenerating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }`}
              >
                {isRemixGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    편집 중...
                  </div>
                ) : (
                  '영역 편집 생성'
                )}
              </button>
            </div>
          )}

          {/* 색상 변경 입력 */}
          {remixCategory === 'recolor' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      색상을 변경할 객체 지정
                    </label>
                    <div className="relative group">
                      <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                        <span className="text-xs font-bold text-gray-600">?</span>
                      </div>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg z-10">
                        색상을 변경하고 싶은 객체를 지정합니다
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={selectPrompt}
                    onChange={(e) => setSelectPrompt(e.target.value)}
                    placeholder="예: 자동차, 셔츠, 꽃, 머리카락, 눈..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      새로운 색상 프롬프트
                    </label>
                    <div className="relative group">
                      <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                        <span className="text-xs font-bold text-gray-600">?</span>
                      </div>
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg z-10">
                        새로운 색상을 포함한 객체 설명을 입력합니다
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  <textarea
                    value={colorPrompt}
                    onChange={(e) => setColorPrompt(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && colorPrompt.trim() && selectPrompt.trim() && !isRemixGenerating) {
                        e.preventDefault();
                        handleRemixGenerate('recolor');
                      }
                    }}
                    placeholder="어떤 색상으로 변경하시겠어요? (예: 빨간 자동차, 파란 셔츠, 초록 머리카락, 갈색 눈)"
                    className="w-full h-20 px-4 py-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  />
                </div>
                <button
                  onClick={() => handleRemixGenerate('recolor')}
                  disabled={!colorPrompt.trim() || !selectPrompt.trim() || isRemixGenerating}
                  className={`px-6 py-3 rounded-md font-medium transition-all duration-200 ${
                    !colorPrompt.trim() || !selectPrompt.trim() || isRemixGenerating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                  }`}
                >
                  {isRemixGenerating ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      편집 중...
                    </div>
                  ) : (
                    '색상 변경 생성'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 이미지 확장 입력 */}
          {remixCategory === 'outpaint' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  확장할 방향 선택
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['up', 'down', 'left', 'right'].map(direction => (
                    <button
                      key={direction}
                      onClick={() => toggleOutpaintDirection(direction)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        outpaintDirections.includes(direction)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {direction === 'up' && '위쪽'}
                      {direction === 'down' && '아래쪽'}
                      {direction === 'left' && '왼쪽'}
                      {direction === 'right' && '오른쪽'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  확장 크기: {outpaintPixels}px
                </label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="50"
                  value={outpaintPixels}
                  onChange={(e) => setOutpaintPixels(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    확장 영역 프롬프트 (선택사항)
                  </label>
                  <div className="relative group">
                    <div className="w-4 h-4 bg-gray-300 rounded-full flex items-center justify-center cursor-help">
                      <span className="text-xs font-bold text-gray-600">?</span>
                    </div>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg z-10">
                      확장될 영역에 어떤 내용을 넣고 싶으신가요? (예: mountains, ocean, city)
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                  <textarea
                    value={remixPrompt}
                    onChange={(e) => setRemixPrompt(e.target.value)}
                    placeholder="확장될 영역에 어떤 내용을 넣고 싶으신가요? (예: 산, 바다, 도시)"
                    className="w-full h-20 px-4 py-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                  />
                </div>
                <button
                  onClick={() => {
                    // 개발중 - 클릭 비활성화
                    return;
                  }}
                  className="w-full px-3 py-2 text-left rounded-md transition-colors opacity-50 cursor-not-allowed"
                  disabled
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                    </svg>
                    <div>
                      <div className="font-medium text-sm">이미지 확장</div>
                      <div className="text-xs text-gray-400">이미지 경계를 확장</div>
                      <div className="text-xs text-yellow-400 mt-1">🚧 개발중</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 