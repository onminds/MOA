"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from '../components/Header';
import { useToast } from "@/contexts/ToastContext";
import { createUsageToastData, createUsageToastMessage } from "@/lib/toast-utils";

import {
  Download, X, RotateCcw, User, Palette, Ruler, Paperclip, ChevronDown, MoreVertical, Save, RefreshCw, History, FileImage, Trash2, Clock, Loader2
} from 'lucide-react';
import RemixMode from './RemixMode';

export default function ImageCreate() {
  const router = useRouter();
  const { showToast } = useToast();
  
  // RemixMode 컴포넌트의 리셋 함수 참조
  const resetEditingStateRef = useRef<(() => void) | null>(null);
  
  const [userInput, setUserInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("Stable Diffusion XL");
  const [selectedStyle, setSelectedStyle] = useState("자동 스타일");
  const [selectedSize, setSelectedSize] = useState("1024x1024");
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [autoPrompt, setAutoPrompt] = useState(true);
  const [isRemixMode, setIsRemixMode] = useState(false);
  const [remixPrompt, setRemixPrompt] = useState("");
  const [remixCategory, setRemixCategory] = useState<'background' | 'subject' | 'other' | 'remove-background' | 'inpaint' | 'recolor' | 'outpaint' | null>(null);
  const [isRemixGenerating, setIsRemixGenerating] = useState(false);
  const [remixPreview, setRemixPreview] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  // SSR → CSR 하이드레이션 불일치 방지용 마운트 플래그
  const [isClient, setIsClient] = useState(false);
  
  // 고급 편집 기능을 위한 상태들
  const [searchPrompt, setSearchPrompt] = useState("");
  const [selectPrompt, setSelectPrompt] = useState("");
  const [colorPrompt, setColorPrompt] = useState("");
  const [maskCanvas, setMaskCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40); // 20에서 40으로 증가
  const [outpaintDirections, setOutpaintDirections] = useState<string[]>([]);
  const [outpaintPixels, setOutpaintPixels] = useState(200);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [backgroundPrompt, setBackgroundPrompt] = useState(""); // 새로운 배경 프롬프트
  const [imageUpdateKey, setImageUpdateKey] = useState(0); // 이미지 강제 업데이트용
  const [isPreviewMode, setIsPreviewMode] = useState(false); // 미리보기 모드 상태
  const [showBeforeAfter, setShowBeforeAfter] = useState(false); // 전후 비교 모드 상태
  const [isImageLoading, setIsImageLoading] = useState(false); // 이미지 로딩 상태
  // 현재 표시 중인 이미지의 사이즈를 잠그기 위한 상태(생성 완료 후 변경해도 표시 크기는 고정)
  const [lockedSize, setLockedSize] = useState<string | null>(null);
  // API 요청 취소를 위한 AbortController
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  // 이미지 히스토리 관련 상태
  const [dbHistory, setDbHistory] = useState<ImageHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
    const activeSizeName = generatedImage && lockedSize ? lockedSize : selectedSize;
    const selectedSizeObj = sizes.find(size => size.name === activeSizeName);
    return selectedSizeObj || sizes[0];
  };

  const getAspectRatio = () => {
    const size = getSelectedSize();
    return size.width / size.height;
  };

  // 클라이언트 마운트 후에만 드래그 이벤트 핸들러를 바인딩
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 이미지 히스토리 인터페이스 정의
  interface ImageHistoryItem {
    id: number;
    prompt: string;
    generatedImageUrl: string;
    model: string;
    size: string;
    style: string;
    quality: string;
    title: string;
    createdAt: string;
    status: string;
  }

  const getContainerStyle = () => {
    const aspectRatio = getAspectRatio();
    
    if (aspectRatio > 1.5) {
      // 16:9 (가로형) - 원본 크기 그대로
      return {
        aspectRatio: aspectRatio,
        maxWidth: '800px',
        maxHeight: '500px',
        width: '100%',
        height: '500px', // 고정 높이로 레이아웃 점프 방지 (1:1, 9:16과 동일)
        minHeight: '500px'
      };
    } else if (aspectRatio < 0.7) {
      // 9:16 (세로형) - 원본 크기 그대로, 오른쪽으로 약간 이동
      return {
        aspectRatio: aspectRatio,
        maxWidth: '300px',
        maxHeight: '500px',
        width: '100%',
        height: '500px', // 고정 높이로 레이아웃 점프 방지
        minHeight: '500px',
        marginLeft: '10px'
      };
    } else {
      // 1:1 (정사각형) - 기존대로
      return {
        aspectRatio: aspectRatio,
        maxWidth: '500px',
        maxHeight: '500px',
        width: '100%',
        height: '500px', // 고정 높이로 레이아웃 점프 방지
        minHeight: '500px'
      };
    }
  };

  const handleFileAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    // Stable Diffusion XL, Kandinsky, Realistic Vision에서는 첨부 불가
    if (selectedModel === "Stable Diffusion XL" || selectedModel === "Kandinsky" || selectedModel === "Realistic Vision") {
      return;
    }
    setAttachedFiles(prev => [...prev, ...files]);
    // 이미지 분석 프롬프트가 입력창에 채워지는 문제 방지를 위해 자동 생성 호출 비활성화
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
    
    // Stable Diffusion XL, Kandinsky, Realistic Vision에서는 드래그 앤 드롭 첨부 불가
    if (selectedModel === "Stable Diffusion XL" || selectedModel === "Kandinsky" || selectedModel === "Realistic Vision") {
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    setAttachedFiles(prev => [...prev, ...files]);
    // 이미지 분석 프롬프트가 입력창에 채워지는 문제 방지를 위해 자동 생성 호출 비활성화
  };

  const generatePromptFromImage = async (imageFiles: File[]) => {
    try {
      if (imageFiles.length === 0) return;
      
      // 여러 이미지를 분석하여 통합된 프롬프트 생성
      let combinedPrompt = "";
      
      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i];
        const formData = new FormData();
        formData.append('image', imageFile);
        
        const response = await fetch('/api/image-analyze', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.prompt) {
            if (combinedPrompt) {
              combinedPrompt += `, ${data.prompt}`;
            } else {
              combinedPrompt = data.prompt;
            }
          }
        }
      }
      // 입력창에 자동으로 채우지 않음 (사용자 입력 보호)
    } catch (error) {
      console.error('이미지 분석 중 오류:', error);
      // 오류 시에도 입력창 내용을 변경하지 않음
    }
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadImage = () => {
    // 리믹스 모드에서 편집된 이미지가 있으면 그것을 다운로드
    const imageToDownload = isRemixMode && remixPreview ? remixPreview : generatedImage;
    
    console.log('다운로드 시도:', {
      isRemixMode,
      hasRemixPreview: !!remixPreview,
      hasGeneratedImage: !!generatedImage,
      imageToDownload: imageToDownload?.substring(0, 50) + '...'
    });
    
    if (imageToDownload) {
      // 클라이언트에서 직접 다운로드 (새 창 방지)
      const link = document.createElement('a');
      link.href = imageToDownload;
      link.download = `generated-image-${Date.now()}.png`;
      link.target = '_blank'; // 새 창에서 열리도록 설정
      link.rel = 'noopener noreferrer'; // 보안 설정
      
      // 링크를 DOM에 추가하고 클릭 후 제거
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('다운로드 완료');
    } else {
      console.error('다운로드할 이미지가 없습니다');
    }
  };

  const handleSaveImage = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `generated-image-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleNewImage = () => {
    // 리믹스 모드에서 새로 만들기를 누르면 리믹스 모드 종료
    if (isRemixMode) {
      handleExitRemixMode();
      return;
    }
    
    setGeneratedImage(null);
    setUserInput("");
    setAttachedFiles([]);
    setLockedSize(null); // 잠금 해제하여 미리보기/다음 생성에 선택값 적용
  };

  // 이미지 히스토리 로드 함수
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      console.log('🔄 이미지 히스토리 로드 시작...');
      
      // 현재 사용자 정보 확인
      const userResponse = await fetch('/api/auth/session');
      const userData = await userResponse.json();
      console.log('👤 현재 사용자 정보:', userData);
      
      const response = await fetch('/api/image-generate/history');
      const data = await response.json();
      
      if (response.ok && data.success) {
        // 모든 히스토리 표시
        setDbHistory(data.history);
      } else {
        console.error('❌ 이미지 히스토리 로드 실패:', data.error);
      }
    } catch (error) {
      console.error('❌ 이미지 히스토리 로드 중 오류:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 이미지 히스토리 삭제 함수
  const deleteHistoryItem = async (id: number) => {
    try {
      const response = await fetch(`/api/image-generate/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDbHistory(prev => prev.filter(item => item.id !== id));
      } else {
        console.error('❌ 이미지 히스토리 삭제 실패');
      }
    } catch (error) {
      console.error('❌ 이미지 히스토리 삭제 중 오류:', error);
    }
  };

  // 이미지 히스토리 항목을 메인 화면에 로드하는 함수
  const loadHistoryItem = (item: ImageHistoryItem) => {
    setUserInput(item.title); // item.prompt 대신 item.title 사용 (사용자 원본 입력)
    setSelectedSize(item.size !== 'unknown' ? item.size : '1024x1024');
    setSelectedStyle(item.style !== 'unknown' ? item.style : '자동 스타일');
    setGeneratedImage(item.generatedImageUrl);
    setLockedSize(item.size && item.size !== 'unknown' ? item.size : '1024x1024');
    
    // 결과 영역으로 스크롤
    setTimeout(() => {
      const resultElement = document.querySelector('.generated-image-container');
      if (resultElement) {
        resultElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }, 100);
  };

  // 이미지를 영상으로 변환 페이지로 이동하는 함수
  const handleImageToVideo = () => {
    console.log('🎬 이미지를 영상으로 변환 시작');
    console.log('📸 현재 생성된 이미지:', generatedImage);
    
    if (generatedImage) {
      // 현재 이미지를 File 객체로 변환하여 영상 생성 페이지로 전달
      // URL을 쿼리 파라미터로 전달
      const videoCreateUrl = `/video-create?imageUrl=${encodeURIComponent(generatedImage)}`;
      console.log('🔗 이동할 URL:', videoCreateUrl);
      
      try {
        // Next.js router를 사용하여 페이지 이동
        router.push(videoCreateUrl);
        console.log('✅ 페이지 이동 시도 완료');
      } catch (error) {
        console.error('❌ 페이지 이동 실패:', error);
        // fallback으로 window.location 사용
        window.location.href = videoCreateUrl;
      }
    } else {
      console.log('❌ 생성된 이미지가 없습니다');
    }
  };

  const handleGenerate = async () => {
    if (!userInput.trim()) return;
    
    // 새로운 AbortController 생성
    const controller = new AbortController();
    setAbortController(controller);
    
    // 이번 생성에서 사용할 사이즈를 잠금
    setLockedSize(selectedSize);
    
    // 생성 중에는 드롭다운들을 닫아 비활성화 상태를 명확히 표시
    setShowModelDropdown(false);
    setShowStyleDropdown(false);
    setShowSizeDropdown(false);

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
        // 자동 프롬프트에 조화로운 이미지 요청 추가
        const enhancedPrompt = `${combinedPrompt}, make the subject and background harmonious and well-balanced`;
        
        const optimizeResponse = await fetch("/api/optimize-prompt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            model: selectedModel,
            translateOnly: attachedFiles.length > 0 // 이미지 첨부 시 번역만
          }),
          signal: controller.signal // AbortController 신호 추가
        });

        if (!optimizeResponse.ok) {
          throw new Error('프롬프트 최적화에 실패했습니다.');
        }

        const optimizeData = await optimizeResponse.json();
        // Base64로 인코딩된 프롬프트를 디코딩 (브라우저 호환)
        finalPrompt = optimizeData.data ? atob(optimizeData.data) : optimizeData.optimizedPrompt;
      }
      
      formData.append('prompt', finalPrompt);
      formData.append('originalPrompt', userInput); // 사용자 원본 입력 추가
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
        console.log('참고 이미지 첨부됨:', {
          autoPrompt,
          attachedFilesCount: attachedFiles.length,
          files: attachedFiles.map(f => ({ name: f.name, size: f.size, type: f.type }))
        });
      }

      const res = await fetch("/api/image-generate", {
        method: "POST",
        body: formData,
        signal: controller.signal // AbortController 신호 추가
      });
      
      // 요청이 취소되었는지 확인
      if (controller.signal.aborted) {
        console.log('이미지 생성이 사용자에 의해 취소되었습니다.');
        return;
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error || '이미지 생성에 실패했습니다.';
        
        // 상태 코드별 에러 처리
        if (res.status === 429) {
          const errorMessage = errorData.error || '사용량 한도에 도달했습니다.';
          const upgradeMessage = errorData.upgradeMessage || '';
          const currentUsage = errorData.currentUsage || 0;
          const maxLimit = errorData.maxLimit || 0;
          const planType = errorData.planType || 'basic';
          
          let detailedMessage = errorMessage;
          if (currentUsage && maxLimit) {
            detailedMessage += ` (현재: ${currentUsage}/${maxLimit})`;
          }
          if (upgradeMessage) {
            detailedMessage += ` ${upgradeMessage}`;
          }

          // 한도 초과 Toast
          try {
            const toastData = createUsageToastData('image-generate', currentUsage, maxLimit);
            const resetText = errorData?.resetDate ? `\n재설정: ${new Date(errorData.resetDate).toLocaleString('ko-KR')}` : '';
            showToast({
              type: 'error',
              title: `${toastData.serviceName} 한도 초과`,
              message: `${createUsageToastMessage(toastData)}${resetText}`,
              duration: 6000
            });
          } catch {}
          
          throw new Error(detailedMessage);
        } else if (res.status === 401) {
          throw new Error(errorMessage || '인증에 실패했습니다. 다시 로그인해주세요.');
        } else if (res.status === 400) {
          throw new Error(errorMessage || '잘못된 요청입니다. 입력값을 확인해주세요.');
        } else if (res.status === 500) {
          throw new Error(errorMessage || '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } else {
          throw new Error(errorMessage);
        }
      }
      
      const data = await res.json();
      console.log('API 응답 데이터:', data);
      console.log('응답 상태:', res.status, res.statusText);
      console.log('URL 존재 여부:', !!data.url);
      console.log('URL 타입:', typeof data.url);
      console.log('URL 내용:', data.url);
      
      // URL이 유효한지 확인
      if (data.url && typeof data.url === 'string' && data.url.trim() !== '') {
        console.log('유효한 URL 확인됨, 이미지 설정 중:', data.url);
        setGeneratedImage(data.url);
        console.log('이미지 상태 업데이트 완료');
        
        // 이미지 생성 성공 후 히스토리 새로고침
        loadHistory();

        // 성공 Toast (사용량 정보가 있으면 통합 표기)
        try {
          if (data.usage) {
            const current = typeof data.usage.current === 'number' ? data.usage.current : (data.usage.usageCount ?? 0);
            const limit = typeof data.usage.limit === 'number' ? data.usage.limit : (data.usage.limitCount ?? 0);
            const toastData = createUsageToastData('image-generate', current, limit);
            showToast({
              type: 'success',
              title: `${toastData.serviceName} 사용`,
              message: createUsageToastMessage(toastData),
              duration: 5000
            });
          }
        } catch {}
      } else {
        console.error('API에서 유효하지 않은 URL을 받았습니다:', data);
        throw new Error('이미지 생성에 실패했습니다. 유효한 URL을 받지 못했습니다.');
      }
    } catch (err) {
      // AbortError는 사용자 취소이므로 에러로 처리하지 않음
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('이미지 생성이 취소되었습니다.');
        return;
      }
      
      // 사용자에게는 에러 메시지 표시하되, 콘솔에는 한 번만 로그
      if (err instanceof Error) {
        // 구체적인 에러 메시지가 있으면 그대로 사용
        if (err.message && err.message !== '이미지 생성에 실패했습니다.') {
          setError(err.message);
          // 콘솔에는 간단한 로그만
          console.log('이미지 생성 실패:', err.message);
        } else {
          // 일반적인 에러 메시지
          setError('이미지 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          console.log('이미지 생성 중 오류 발생');
        }
      } else {
        setError("서버 오류가 발생했습니다.");
        console.log('서버 오류 발생');
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  const handleRemixGenerate = async (category: 'background' | 'subject' | 'other' | 'remove-background' | 'inpaint' | 'recolor' | 'outpaint') => {
    if (!generatedImage) return;
    
    // 프롬프트 필요 조건 체크
    if (category === 'background' && !backgroundPrompt.trim()) {
      setError('새로운 배경 프롬프트를 입력해주세요.');
      return;
    }
    
    // recolor는 selectPrompt와 colorPrompt가 필요
    if (category === 'recolor') {
      if (!selectPrompt.trim() || !colorPrompt.trim()) {
        setError('색상을 변경할 객체와 새로운 색상 프롬프트를 모두 입력해주세요.');
        return;
      }
    } else if (category !== 'remove-background' && category !== 'background' && !remixPrompt.trim()) {
      setError('프롬프트를 입력해주세요.');
      return;
    }
    
    setIsRemixGenerating(true);
    setError(null);
    
    try {
      const selectedSizeObj = getSelectedSize();
      const formData = new FormData();
      
      // 자동 프롬프트 최적화 적용
      let finalPrompt = '';
      if (category === 'background') {
        finalPrompt = backgroundPrompt || 'background processing';
      } else if (category === 'recolor') {
        // recolor는 colorPrompt를 사용
        finalPrompt = colorPrompt || 'color change';
      } else {
        finalPrompt = remixPrompt || 'background processing';
      }
      
      // 자동 프롬프트가 켜져있으면 OpenAI로 번역 및 최적화
      if (autoPrompt && finalPrompt !== 'background processing') {
        try {
          const optimizeResponse = await fetch("/api/optimize-prompt", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prompt: finalPrompt,
              model: "Stable Diffusion XL",
              translateOnly: true // 리믹스는 항상 번역만
            }),
          });

          if (optimizeResponse.ok) {
            const optimizeData = await optimizeResponse.json();
            // Base64로 인코딩된 프롬프트를 디코딩 (브라우저 호환)
            finalPrompt = optimizeData.data ? atob(optimizeData.data) : optimizeData.optimizedPrompt;
            console.log('리믹스 프롬프트 최적화:', {
              category,
              original: '***', // 보안상 로그에서도 마스킹
              optimized: '***' // 보안상 로그에서도 마스킹
            });
          }
        } catch (error) {
          console.error('리믹스 프롬프트 최적화 실패:', error);
          // 최적화 실패 시 원본 프롬프트 사용
        }
      }
      
      // 기본 파라미터
      if (category === 'background') {
        // 배경 변경에서는 backgroundPrompt만 사용
        formData.append('prompt', finalPrompt);
      } else {
        // 다른 카테고리에서는 기존 로직 사용
        formData.append('prompt', finalPrompt);
      }
      formData.append('initImage', generatedImage);
      formData.append('category', category);
      
      // 카테고리별 추가 파라미터
      switch (category) {
        case 'background':
          // 배경 변경은 2단계 프로세스로 처리되므로 추가 파라미터 불필요
          // 배경 프롬프트가 비어있으면 기본값 설정
          if (!backgroundPrompt.trim()) {
            formData.append('backgroundPrompt', 'a beautiful natural landscape');
          } else {
            formData.append('backgroundPrompt', backgroundPrompt);
          }
          break;
        case 'subject':
          formData.append('searchPrompt', searchPrompt || 'person');
          break;
        case 'remove-background':
          // Remove Background는 프롬프트 불필요
          break;
        case 'inpaint':
          // 메인 이미지의 마스크 캔버스에서 데이터 가져오기
          console.log('=== 영역 편집 마스크 데이터 수집 시작 ===');
          
          // 여러 방법으로 캔버스 찾기
          let mainCanvas = document.querySelector('canvas[class*="cursor-crosshair"]') as HTMLCanvasElement;
          console.log('첫 번째 시도 - cursor-crosshair:', !!mainCanvas);
          
          if (!mainCanvas) {
            // 대안 1: 절대 위치로 찾기
            mainCanvas = document.querySelector('canvas.absolute.inset-0.cursor-crosshair') as HTMLCanvasElement;
            console.log('두 번째 시도 - absolute.inset-0.cursor-crosshair:', !!mainCanvas);
          }
          
          if (!mainCanvas) {
            // 대안 2: 모든 캔버스 중에서 inpaint 모드의 캔버스 찾기
            const allCanvases = document.querySelectorAll('canvas');
            console.log('발견된 캔버스 개수:', allCanvases.length);
            
            for (let i = 0; i < allCanvases.length; i++) {
              const canvas = allCanvases[i] as HTMLCanvasElement;
              console.log(`캔버스 ${i}:`, {
                className: canvas.className,
                width: canvas.width,
                height: canvas.height,
                hasCursorCrosshair: canvas.className.includes('cursor-crosshair'),
                hasAbsolute: canvas.className.includes('absolute'),
                hasInset0: canvas.className.includes('inset-0')
              });
              
              if (canvas.className.includes('cursor-crosshair') || 
                  (canvas.className.includes('absolute') && canvas.className.includes('inset-0'))) {
                mainCanvas = canvas;
                console.log(`캔버스 ${i}를 선택했습니다!`);
                break;
              }
            }
          }
          
          if (mainCanvas) {
            console.log('마스크 캔버스 발견:', {
              width: mainCanvas.width,
              height: mainCanvas.height,
              className: mainCanvas.className
            });
            
            const maskData = mainCanvas.toDataURL('image/png');
            formData.append('maskData', maskData);
            
            // 마스크 데이터 디버깅
            console.log('마스크 데이터 전송:', {
              canvasFound: !!mainCanvas,
              canvasWidth: mainCanvas.width,
              canvasHeight: mainCanvas.height,
              maskDataLength: maskData.length,
              maskDataStart: maskData.substring(0, 50) + '...',
              hasDrawing: maskData.length > 1000 // 기본 검은색 마스크보다 크면 그리기가 있음
            });
            
            // 마스크가 제대로 그려졌는지 확인
            const ctx = mainCanvas.getContext('2d');
            if (ctx) {
              const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
              const data = imageData.data;
              let whitePixels = 0;
              let totalPixels = 0;
              
              for (let i = 0; i < data.length; i += 4) {
                totalPixels++;
                if (data[i] > 128 && data[i + 1] > 128 && data[i + 2] > 128) {
                  whitePixels++;
                }
              }
              
              console.log('마스크 분석:', {
                totalPixels,
                whitePixels,
                whitePixelRatio: (whitePixels / totalPixels * 100).toFixed(2) + '%',
                hasSignificantDrawing: whitePixels > totalPixels * 0.01 // 1% 이상 그려졌으면 의미있는 그리기로 간주
              });
            }
          } else {
            console.error('마스크 캔버스를 찾을 수 없습니다!');
            // 기본 마스크 생성 (전체 영역을 편집 대상으로)
            const defaultCanvas = document.createElement('canvas');
            defaultCanvas.width = 1024;
            defaultCanvas.height = 1024;
            const defaultCtx = defaultCanvas.getContext('2d');
            if (defaultCtx) {
              // 전체 영역을 흰색으로 (편집 대상)
              defaultCtx.fillStyle = 'white';
              defaultCtx.fillRect(0, 0, 1024, 1024);
              const defaultMaskData = defaultCanvas.toDataURL('image/png');
              formData.append('maskData', defaultMaskData);
              console.log('기본 마스크 생성 및 전송:', {
                maskDataLength: defaultMaskData.length
              });
            }
          }
          
          console.log('=== 영역 편집 마스크 데이터 수집 완료 ===');
          break;
        case 'recolor':
          formData.append('selectPrompt', selectPrompt);
          formData.append('colorPrompt', colorPrompt);
          break;
        case 'outpaint':
          formData.append('outpaintDirection', outpaintDirections.join(','));
          formData.append('outpaintPixels', outpaintPixels.toString());
          break;
        default: // 'other'
          break;
      }
      
      // 디버깅: FormData 전송 직전 확인
      console.log('FormData 전송 직전 확인:', {
        category,
        backgroundPrompt,
        backgroundPromptLength: backgroundPrompt?.length,
        backgroundPromptTrimmed: backgroundPrompt?.trim(),
        isEmpty: !backgroundPrompt?.trim(),
        // recolor 특별 디버깅
        ...(category === 'recolor' && {
          selectPrompt,
          colorPrompt,
          selectPromptLength: selectPrompt?.length,
          colorPromptLength: colorPrompt?.length,
          selectPromptTrimmed: selectPrompt?.trim(),
          colorPromptTrimmed: colorPrompt?.trim()
        })
      });
      
      // FormData 내용 확인
      console.log('FormData 내용:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
      }
      
      const res = await fetch("/api/image-remix", {
        method: "POST",
        body: formData,
      });
      
      console.log('API 응답 상태:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API 오류 응답:', errorText);
        throw new Error(`이미지 편집에 실패했습니다. (${res.status})`);
      }
      
      const data = await res.json();
      console.log('리믹스 API 응답:', data); // 디버깅용 로그 추가
      console.log('응답 데이터 구조:', {
        hasUrl: !!data.url,
        urlLength: data.url?.length,
        category: data.category,
        prompt: data.prompt,
        urlStart: data.url?.substring(0, 50)
      });
      
      // base64 이미지 URL 또는 일반 URL 모두 처리
      if (data.url && (data.url.startsWith('data:image/') || data.url.startsWith('http'))) {
        console.log('미리보기 설정 시작:', {
          category: data.category,
          urlStart: data.url.substring(0, 100) + '...',
          currentRemixPreview: !!remixPreview,
          urlType: data.url.startsWith('data:image/') ? 'base64' : 'http'
        });
        
        // 즉시 미리보기 설정
        setRemixPreview(data.url);
        setImageUpdateKey(prev => prev + 1);
        setIsPreviewMode(true); // 미리보기 모드 활성화
        setShowBeforeAfter(true); // 편집 완료 시 After 상태로 자동 변경
        
        console.log('상태 업데이트 완료:', {
          remixPreview: data.url.substring(0, 50) + '...',
          imageUpdateKey: imageUpdateKey + 1,
          isPreviewMode: true,
          showBeforeAfter: true
        });
        
        // 입력 필드들 초기화 (지연)
        setTimeout(() => {
          if (data.category !== 'background') {
            setRemixPrompt("");
          }
          setSearchPrompt("");
          setSelectPrompt("");
          setColorPrompt("");
          if (data.category === 'background') {
            setBackgroundPrompt(""); // 배경 변경 후에만 배경 프롬프트 초기화
          }
          
          console.log('미리보기 상태 업데이트 완료:', {
            category: data.category,
            hasRemixPreview: true,
            imageUpdateKey: imageUpdateKey + 1,
            isPreviewMode: true
          });
        }, 500);
      } else {
        console.error('API 응답에 유효한 url이 없습니다:', {
          hasUrl: !!data.url,
          urlType: typeof data.url,
          urlStart: data.url?.substring(0, 50),
          fullData: data
        });
        setError('이미지 편집 결과를 받지 못했습니다.');
      }
    } catch (err) {
      console.error('이미지 편집 에러:', err);
      
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("이미지 편집 중 오류가 발생했습니다.");
      }
    } finally {
      setIsRemixGenerating(false);
      // setRemixCategory(null); // 성공 시에는 카테고리를 유지하여 미리보기 상태를 보존
    }
  };

  const handleApplyRemix = () => {
    console.log('적용하기 클릭, remixPreview:', remixPreview); // 디버깅용 로그
    if (remixPreview) {
      console.log('이미지 적용 시작:', {
        currentGeneratedImage: generatedImage?.substring(0, 50) + '...',
        newImage: remixPreview.substring(0, 50) + '...'
      });
      
      setGeneratedImage(remixPreview);
      setImageUpdateKey(prev => prev + 1); // 강제 리렌더링
      
      // 상태 초기화를 지연시켜 미리보기가 제대로 적용되도록 함
      setTimeout(() => {
        setRemixPreview(null);
        setRemixCategory(null); // 적용 후 카테고리 초기화
        setIsPreviewMode(false); // 미리보기 모드 비활성화
        console.log('이미지 적용 완료 및 상태 초기화'); // 적용 완료 로그
      }, 100);
    } else {
      console.log('remixPreview가 없습니다'); // 미리보기 없음 로그
    }
  };

  const handleDiscardRemix = () => {
    setRemixPreview(null);
    setRemixCategory(null); // 버리기 후 카테고리 초기화
    setIsPreviewMode(false); // 미리보기 모드 비활성화
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

  const handleRemixMode = async () => {
    // 이미지 로딩 상태 시작
    setIsImageLoading(true);
    
    // 이미지가 완전히 로드될 때까지 잠시 대기
    if (generatedImage) {
      const img = new window.Image();
      img.onload = () => {
        // 이미지 로딩 완료 후 상태 변경
        setTimeout(() => {
          setRemixPrompt(""); // 빈 문자열로 초기화
          setOriginalImage(generatedImage); // 원본 이미지 저장
          setRemixPreview(null); // 미리보기 초기화
          setShowBeforeAfter(false); // Before 상태로 초기화
          setShowAdvancedOptions(false); // 고급 기능 드롭다운 닫기
          // 리믹스 모드에서는 Stability AI 사용
          setSelectedModel("Stable Diffusion XL");
          
          // 카테고리를 먼저 설정
          setRemixCategory('background');
          
          // 리믹스 모드 활성화
          setIsRemixMode(true);
          
          // 로딩 상태 종료
          setIsImageLoading(false);
        }, 300); // 300ms 지연
      };
      img.onerror = () => {
        // 이미지 로딩 실패 시에도 진행
        setTimeout(() => {
          setRemixPrompt(""); // 빈 문자열로 초기화
          setOriginalImage(generatedImage);
          setRemixPreview(null);
          setShowBeforeAfter(false);
          setShowAdvancedOptions(false);
          setSelectedModel("Stable Diffusion XL");
          setRemixCategory('background');
          setIsRemixMode(true);
          setIsImageLoading(false);
        }, 300);
      };
      img.src = generatedImage;
    } else {
      // 이미지가 없는 경우 즉시 진행
      setRemixPrompt(""); // 빈 문자열로 초기화
      setOriginalImage(generatedImage);
      setRemixPreview(null);
      setShowBeforeAfter(false);
      setShowAdvancedOptions(false);
      setSelectedModel("Stable Diffusion XL");
      setRemixCategory('background');
      setIsRemixMode(true);
      setIsImageLoading(false);
    }
  };

  const handleExitRemixMode = () => {
    // RemixMode 컴포넌트의 편집 상태 초기화
    if (resetEditingStateRef.current) {
      resetEditingStateRef.current();
    }
    
    // 상태 초기화를 먼저 수행
    setRemixPrompt("");
    setRemixCategory(null);
    setRemixPreview(null);
    setOriginalImage(null);
    setSearchPrompt("");
    setSelectPrompt("");
    setColorPrompt("");
    setMaskCanvas(null);
    setOutpaintDirections([]);
    setShowAdvancedOptions(false);
    setBackgroundPrompt(""); // 배경 프롬프트 초기화
    setIsPreviewMode(false); // 미리보기 모드 초기화
    setShowBeforeAfter(false); // 전후 비교 모드 초기화
    
    // 마지막에 리믹스 모드 비활성화
    setTimeout(() => {
      setIsRemixMode(false);
    }, 0);
  };

  // 마스크 그리기 함수들
  const initMaskCanvas = () => {
    // 메인 이미지의 캔버스가 자동으로 초기화되므로 별도 작업 불필요
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 브러시 크기를 동적으로 조정 (더 큰 영역을 그리기 위해)
      const dynamicBrushSize = brushSize * 1.5; // 브러시 크기를 1.5배로 증가
      
      // 하얀색으로 그리기
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // 하얀색으로 설정
      
      // 원형 브러시 그리기
      ctx.beginPath();
      ctx.arc(x, y, dynamicBrushSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  };

  const clearMask = () => {
    const canvas = document.querySelector('canvas[class*="cursor-crosshair"]') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // 완전히 투명하게 초기화
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // 초기화 상태 리셋
    delete canvas.dataset.initialized;
  };

  const toggleOutpaintDirection = (direction: string) => {
    setOutpaintDirections(prev => 
      prev.includes(direction) 
        ? prev.filter(d => d !== direction)
        : [...prev, direction]
    );
  };

  // 이미지 상태 변화 로깅
  useEffect(() => {
    if (remixPreview) {
      console.log('미리보기 상태 변경:', { 
        remixPreview: remixPreview.substring(0, 50) + '...', 
        imageUpdateKey,
        isPreviewMode
      });
    }
  }, [remixPreview, imageUpdateKey, isPreviewMode]);

  useEffect(() => {
    if (generatedImage) {
      console.log('생성된 이미지 상태 변경:', { 
        generatedImage: generatedImage.substring(0, 50) + '...', 
        imageUpdateKey 
      });
    }
  }, [generatedImage, imageUpdateKey]);

  // 로딩 상태 변화 추적
  useEffect(() => {
    console.log('Loading 상태 변경:', loading);
  }, [loading]);

  // 페이지 이탈 시 생성 중단 처리 (강화된 버전)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (loading && abortController) {
        // 생성 중단
        abortController.abort();
        console.log('페이지 이탈로 인한 이미지 생성 중단');
        
        // 브라우저에게 페이지를 떠나려고 한다고 알림
        e.preventDefault();
        e.returnValue = '';
        
        // 강제로 상태 초기화
        setLoading(false);
        setError(null);
        setAbortController(null);
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (loading && abortController) {
        // 뒤로가기로 인한 생성 중단
        abortController.abort();
        console.log('뒤로가기로 인한 이미지 생성 중단');
        setLoading(false);
        setError(null);
        setAbortController(null);
        
        // 히스토리 조작 방지
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
      }
    };

    // 실제 페이지 종료 시에만 작업 중단 (탭 전환은 허용)
    const handlePageHide = (e: Event) => {
      // pagehide 이벤트에서 persisted 속성 확인
      const pageHideEvent = e as any;
      // persisted가 false인 경우에만 실제 페이지 종료로 간주
      if (!pageHideEvent.persisted && loading && abortController) {
        abortController.abort();
        console.log('페이지 완전 종료로 인한 이미지 생성 중단');
        setLoading(false);
        setError(null);
        setAbortController(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading && abortController) {
        // F5와 Alt+F4만 중단 처리
        if ((e.altKey && e.key === 'F4') || // Alt+F4 (창 닫기)
            e.key === 'F5') { // F5 (새로고침)
          abortController.abort();
          console.log('키보드 단축키로 인한 이미지 생성 중단');
          setLoading(false);
          setError(null);
          setAbortController(null);
        }
      }
    };

    // 모든 이벤트 리스너 등록
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('keydown', handleKeyDown);

    // 히스토리 조작 방지 (생성 중일 때)
    if (loading) {
      window.history.pushState(null, '', window.location.href);
    }

    return () => {
      // 컴포넌트 언마운트 시 모든 이벤트 리스너 제거
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('keydown', handleKeyDown);
      
      // 진행 중인 요청이 있으면 취소
      if (abortController) {
        abortController.abort();
        console.log('컴포넌트 언마운트로 인한 이미지 생성 중단');
      }
    };
  }, [loading, abortController]);

  // 컴포넌트 마운트 시 히스토리 로드
  useEffect(() => {
    loadHistory();
  }, []);

  // dbHistory 상태 변경 감지
  useEffect(() => {
    // 상태 변경 감지 (로그 제거)
  }, [dbHistory]);

  // inpaint 카테고리 변경 시 캔버스 초기화
  useEffect(() => {
    if (remixCategory === 'inpaint') {
      const canvas = document.querySelector('canvas[class*="cursor-crosshair"]') as HTMLCanvasElement;
      if (canvas) {
        delete canvas.dataset.initialized;
      }
    }
  }, [remixCategory]);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white">
        <div className="flex">
          <div className="flex-1 flex flex-col items-center justify-start min-h-[calc(100vh-64px)] p-8">
            {/* 상단 안내 문구 제거: 고정 높이 스페이서로 위치만 유지 */}
            <div className="mb-12" style={{ height: '72px' }} />

            {isRemixMode && generatedImage && remixCategory ? (
              <RemixMode
                generatedImage={generatedImage}
                remixCategory={remixCategory}
                setRemixCategory={setRemixCategory}
                remixPreview={remixPreview}
                isPreviewMode={isPreviewMode}
                showBeforeAfter={showBeforeAfter}
                setShowBeforeAfter={setShowBeforeAfter}
                isRemixGenerating={isRemixGenerating}
                remixPrompt={remixPrompt}
                setRemixPrompt={setRemixPrompt}
                backgroundPrompt={backgroundPrompt}
                setBackgroundPrompt={setBackgroundPrompt}
                searchPrompt={searchPrompt}
                setSearchPrompt={setSearchPrompt}
                selectPrompt={selectPrompt}
                setSelectPrompt={setSelectPrompt}
                colorPrompt={colorPrompt}
                setColorPrompt={setColorPrompt}
                outpaintDirections={outpaintDirections}
                setOutpaintDirections={setOutpaintDirections}
                outpaintPixels={outpaintPixels}
                setOutpaintPixels={setOutpaintPixels}
                brushSize={brushSize}
                setBrushSize={setBrushSize}
                showAdvancedOptions={showAdvancedOptions}
                setShowAdvancedOptions={setShowAdvancedOptions}
                imageUpdateKey={imageUpdateKey}
                getSelectedSize={getSelectedSize}
                getContainerStyle={getContainerStyle}
                handleRemixGenerate={handleRemixGenerate}
                handleDownloadImage={handleDownloadImage}
                handleSaveImage={handleSaveImage}
                handleNewImage={handleNewImage}
                handleExitRemixMode={handleExitRemixMode}
                startDrawing={startDrawing}
                stopDrawing={stopDrawing}
                draw={draw}
                clearMask={clearMask}
                toggleOutpaintDirection={toggleOutpaintDirection}
                setGeneratedImage={setGeneratedImage}
                setRemixPreview={setRemixPreview}
                setIsPreviewMode={setIsPreviewMode}
                resetEditingState={resetEditingStateRef}
              />
            ) : (
              /* 기본 모드 레이아웃 */
              <>
                <div className="mb-16">
                  <div className="bg-white rounded-2xl flex items-center justify-center relative" style={getContainerStyle()}>
                    {loading ? (
                      <div className="text-center w-full h-full flex flex-col items-center justify-center bg-white rounded-xl relative z-0">
                        <div className="relative flex items-center justify-center" style={{ transform: 'translateY(2rem)' }}>
                          <div className="text-black font-bold text-5xl relative">MOA</div>
                          <div className="absolute top-16 left-1/2 -translate-x-1/2 transform text-black text-lg font-medium whitespace-nowrap">AI가 이미지 제작중</div>
                          <div className="absolute w-60 h-60 border-2 border-black border-t-transparent rounded-full animate-spin flex items-center justify-center">
                            <div className="w-48 h-48 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '2s'}}></div>
                          </div>
                        </div>
                      </div>
                    ) : generatedImage && generatedImage.trim() !== '' ? (
                      <div className="text-center w-full h-full relative group">
                        <div className="w-full h-full rounded-xl overflow-hidden" style={getContainerStyle()}>
                          <img
                            src={generatedImage}
                            alt="생성된 이미지"
                            width={getSelectedSize().width}
                            height={getSelectedSize().height}
                            className="w-full h-full object-cover"
                            onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                              console.error('이미지 로드 실패:', generatedImage);
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-500">이미지를 불러올 수 없습니다</div>';
                              }
                            }}
                          />
                          
                          <div className="absolute top-4 right-4 z-10 image-menu-container opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="flex gap-2">
                              <div className="relative group/button">
                                <button
                                  onClick={handleDownloadImage}
                                  className="p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all"
                                >
                                  <Download className="w-5 h-5 text-gray-700" />
                                </button>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover/button:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                  이미지 다운로드
                                </div>
                              </div>
                              <div className="relative group/button">
                                <button
                                  onClick={() => {
                                    // 개발중 - 클릭 비활성화
                                    return;
                                  }}
                                  className="p-2 bg-white/50 backdrop-blur-sm rounded-full shadow-lg opacity-50 cursor-not-allowed transition-all"
                                  disabled
                                >
                                  <Save className="w-5 h-5 text-gray-500" />
                                </button>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover/button:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                                  🚧 개발중
                                </div>
                              </div>
                              <div className="relative group/button">
                                <button
                                  onClick={handleNewImage}
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
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <h2 className="text-4xl font-semibold text-gray-800 text-center whitespace-nowrap">이미지를 생성해드립니다!</h2>
                      </div>
                    )}
                  </div>
                  
                  {/* 생성된 이미지 아래 버튼들 */}
                  {generatedImage && (
                    <div className="mt-6 flex justify-center gap-4">
                      <button
                        onClick={handleRemixMode}
                        disabled={isImageLoading}
                        className={`px-8 py-3 bg-gradient-to-r from-gray-800 to-black text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
                          isImageLoading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isImageLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            이미지 로딩중...
                          </div>
                        ) : (
                          '이미지 리믹스'
                        )}
                      </button>
                      <button
                        onClick={handleImageToVideo}
                        className="px-6 py-3 bg-gradient-to-r from-gray-800 to-black text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        이미지를 영상으로
                      </button>
                    </div>
                  )}
                </div>

                {/* 기본 입력창은 리믹스 모드가 아닐 때만 표시 */}
                <div className="w-full max-w-4xl mt-8">
                  <div className="flex items-center gap-4 mb-6 justify-center h-12">
                    <div className="relative">
                      {isRemixMode ? (
                        /* 리믹스 모드에서는 모델 고정 표시 */
                        <div className="flex items-center gap-2 px-3 py-2 border-2 border-gray-400 rounded-lg bg-gray-100 text-sm w-[200px]">
                          <div className="w-8 h-8 rounded overflow-hidden">
                            <img
                              src="/images/models/sdxl.jpg"
                              alt="Stable Diffusion XL"
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
                                  fallback.innerHTML = '<span class="text-white text-xs font-bold">SD</span>';
                                  parent.appendChild(fallback);
                                }
                              }}
                            />
                          </div>
                          <span className="font-medium truncate text-gray-800">Stable Diffusion XL</span>
                          <div className="text-xs text-gray-500 ml-auto">(리믹스 전용)</div>
                        </div>
                      ) : (
                        /* 기본 모드에서는 모델 선택 가능 */
                        <button
                          onClick={handleModelDropdown}
                          disabled={loading}
                          className={`flex items-center gap-2 px-3 py-2 border-2 border-gray-400 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-md w-[200px] hover:border-gray-500 hover:shadow-lg transition-all ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                      )}
                      {showModelDropdown && !isRemixMode && !loading && (
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
                        disabled={loading}
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
                        onClick={handleStyleDropdown}
                        disabled={loading}
                        className={`flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 shadow-sm min-w-[120px] ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className="font-medium">{selectedStyle}</span>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </button>
                      {showStyleDropdown && !loading && (
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
                                      <img
                                        src={style.image}
                                        alt={style.name}
                                        width={80}
                                        height={80}
                                        className="w-full h-full object-cover"
                                        style={{ objectPosition: 'center 30%' }}
                                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
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
                        disabled={loading}
                        className={`flex items-center gap-2 px-3 py-2 border-2 border-gray-400 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-md min-w-[120px] hover:border-gray-500 hover:shadow-lg transition-all ${
                          loading ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <span className="font-medium text-gray-800">{selectedSize}</span>
                        <ChevronDown className="w-4 h-4 text-gray-700" />
                      </button>
                      {showSizeDropdown && !loading && (
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
                            onDragOver={!isClient || (selectedModel === "Kandinsky" || selectedModel === "Realistic Vision" || selectedModel === "Stable Diffusion XL") ? undefined : handleDragOver}
                            onDragLeave={!isClient || (selectedModel === "Kandinsky" || selectedModel === "Realistic Vision" || selectedModel === "Stable Diffusion XL") ? undefined : handleDragLeave}
                            onDrop={!isClient || (selectedModel === "Kandinsky" || selectedModel === "Realistic Vision" || selectedModel === "Stable Diffusion XL") ? undefined : handleDrop}
                          />
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                            {!(selectedModel === "Kandinsky" || selectedModel === "Realistic Vision" || selectedModel === "Stable Diffusion XL") && (
                              <label className={`cursor-pointer p-1 transition-colors text-gray-500 hover:text-gray-700`} title="파일 첨부">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleFileAttach}
                                  multiple
                                  className="hidden"
                                />
                                <Paperclip className="w-4 h-4" />
                              </label>
                            )}
                          </div>
                          
                          {/* 첨부된 이미지들 - 입력창 안에 배치 */}
                          {attachedFiles.length > 0 && (
                            <div className="px-4 pt-3">
                              <div className="flex items-start gap-3 flex-wrap max-h-32 overflow-y-auto">
                                {attachedFiles.map((file, index) => (
                                  <div key={index} className="relative w-[100px] h-[100px] rounded-lg overflow-hidden shadow border border-gray-200 bg-white flex-shrink-0">
                                    {file.type.startsWith('image/') ? (
                                      <img
                                        src={URL.createObjectURL(file)}
                                        alt={file.name}
                                        width={100}
                                        height={100}
                                        className="w-full h-full object-contain mx-auto"
                                        onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = '<div class=\'w-full h-full flex items-center justify-center text-gray-500 text-xs\'>이미지를 불러올 수 없습니다</div>';
                                          }
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                        <Paperclip className="w-6 h-6 text-gray-500" />
                                      </div>
                                    )}
                                    <button
                                      onClick={() => removeAttachedFile(index)}
                                      className="absolute top-1 right-1 p-1 bg-white/80 rounded-full text-red-500 hover:text-red-700 shadow"
                                      title="첨부 파일 제거"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div className="text-xs text-gray-500 mt-2">
                                {attachedFiles.length}개의 이미지가 첨부됨
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* 모델별 안내문구 */}
                        {(selectedModel === "Kandinsky" || selectedModel === "Realistic Vision" || selectedModel === "Stable Diffusion XL") && (
                          <div className="mt-2 text-xs text-gray-500">
                            <strong>{selectedModel}</strong> 모델은 이미지 첨부 기능을 지원하지 않습니다.
                          </div>
                        )}
                        {selectedModel === "DALL-E 3" && (
                          <div className="mt-2 text-xs text-gray-500">
                            <strong>DALL-E 3</strong> 모델은 이미지 첨부 기능을 사용할 수 있습니다.
                          </div>
                        )}
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
                        className={`px-6 py-3 rounded-xl transition-all flex items-center gap-2 border-2 shadow-md text-base font-medium -mt-5 ${
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

                  {/* 이미지 히스토리 섹션 - 상단 고정 레이아웃을 밀지 않도록 최대 높이 스크롤 */}
                  <div className="mt-8 max-h-[480px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        최근 생성된 이미지
                      </h3>
                      <button
                        onClick={loadHistory}
                        disabled={loadingHistory}
                        className="flex items-center gap-2 text-sm text-gray-900 hover:text-black transition-colors bg-transparent border-none p-2 rounded-md hover:bg-gray-100"
                      >
                        {loadingHistory ? (
                          <Loader2 className="w-4 h-4 animate-spin text-gray-900" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-gray-900" />
                        )}
                        새로고침
                      </button>
                    </div>
                    
                    {loadingHistory ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      </div>
                    ) : dbHistory.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-stretch">
                        {dbHistory.map((item) => (
                          <div key={item.id} className="group relative bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-all duration-200 flex flex-col h-full">
                            <div className="aspect-square mb-3 relative overflow-hidden rounded-md">
                              <img
                                src={item.generatedImageUrl}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200" />
                            </div>
                            
                            <div className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight">
                                {item.title}
                              </h4>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <FileImage className="w-3 h-3" />
                                {item.model}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="w-3 h-3" />
                                {new Date(item.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                            
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button
                                onClick={() => deleteHistoryItem(item.id)}
                                className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                                title="삭제"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            
                            <button
                              onClick={() => loadHistoryItem(item)}
                              className="w-full mt-auto text-xs bg-black text-white py-1 rounded hover:bg-gray-800 transition-colors"
                            >
                              불러오기
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <FileImage className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>아직 생성된 이미지가 없습니다.</p>
                        <p className="text-sm">이미지를 생성하면 여기에 표시됩니다.</p>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center max-w-3xl mx-auto">
                      {error}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 