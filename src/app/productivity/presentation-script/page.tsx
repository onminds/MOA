"use client";
import { useState } from "react";
import Header from '../../components/Header';
import { Presentation, Clock, Users, Target, Lightbulb, FileText, Download, Copy, RefreshCw, Upload, X, Plus, CheckCircle, AlertCircle, Info, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PresentationScript() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    topic: '',
    duration: '10',
    audience: '',
    purpose: '',
    keyPoints: [''],
    additionalInfo: '',
    customAudience: '',
    customPurpose: ''
  });
  
  const [generatedScript, setGeneratedScript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 이미지 업로드 관련 상태
  const [uploadedImages, setUploadedImages] = useState<Array<{
    id: string, 
    data: string, 
    text: string,
    fileName: string,
    status: 'processing' | 'success' | 'error',
    errorMessage?: string
  }>>([]);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  // 파일 내용 사용 여부 추적
  const [usedFileContent, setUsedFileContent] = useState<string>('');
  
  // 파일 길이 안내 팝업 상태
  const [showFileInfoPopup, setShowFileInfoPopup] = useState(false);
  const [showEmphasisInfoPopup, setShowEmphasisInfoPopup] = useState(false);
  const [showDurationInfoPopup, setShowDurationInfoPopup] = useState(false);

  // PDF 내용 분석하여 주제 자동 설정
  const analyzePDFContent = (text: string) => {
    console.log('🔍 PDF 내용 분석 시작:', text.substring(0, 200));
    
    // 제목 패턴 찾기
    const titlePatterns = [
      /Chapter\s+\d+\.\s*([^\n]+)/i,
      /^([A-Z][A-Za-z\s]+)\n/i,
      /^([가-힣\s]+)\n/i
    ];
    
    let detectedTitle = '';
    for (const pattern of titlePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        detectedTitle = match[1].trim();
        console.log('📝 감지된 제목:', detectedTitle);
        break;
      }
    }
    
    // 저자 정보 찾기
    const authorPattern = /([가-힣\s]+),\s*(Ph\.D\.|박사|교수)/;
    const authorMatch = text.match(authorPattern);
    const author = authorMatch ? authorMatch[1].trim() : '';
    
    // 목표/목적 찾기
    const objectivesPattern = /Objectives?\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i;
    const objectivesMatch = text.match(objectivesPattern);
    const objectives = objectivesMatch ? objectivesMatch[1].trim() : '';
    
    console.log('📊 PDF 분석 결과:', {
      detectedTitle,
      author,
      objectivesLength: objectives.length
    });
    
    // 주제 자동 설정 제거 - 사용자가 직접 입력한 주제를 유지
    console.log('📝 PDF에서 제목이 감지되었지만 자동 설정하지 않습니다. 사용자가 입력한 주제를 유지합니다.');
    
    return { detectedTitle, author, objectives };
  };

  const durationOptions = [
    { value: '5', label: '5분' },
    { value: '10', label: '10분' },
    { value: '15', label: '15분' }
  ];

  const audienceOptions = [
    { value: 'colleagues', label: '동료 / 팀원' },
    { value: 'executives', label: '경영진 / 임원' },
    { value: 'students', label: '학생 / 수강생' },
    { value: 'general', label: '일반 대중' },
    { value: 'clients', label: '고객 / 클라이언트' },
    { value: 'custom', label: '직접 입력' }
  ];

  const purposeOptions = [
    { value: 'inform', label: '정보 전달' },
    { value: 'persuade', label: '설득 / 제안' },
    { value: 'educate', label: '교육 / 훈련' },
    { value: 'report', label: '보고 / 상황 전달' },
    { value: 'present', label: '제품 / 서비스 소개' },
    { value: 'custom', label: '직접 입력' }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleKeyPointChange = (index: number, value: string) => {
    const newKeyPoints = [...formData.keyPoints];
    newKeyPoints[index] = value;
    setFormData(prev => ({
      ...prev,
      keyPoints: newKeyPoints
    }));
  };

  const addKeyPoint = () => {
    setFormData(prev => ({
      ...prev,
      keyPoints: [...prev.keyPoints, '']
    }));
  };

  const removeKeyPoint = (index: number) => {
    if (formData.keyPoints.length > 1) {
      const newKeyPoints = formData.keyPoints.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        keyPoints: newKeyPoints
      }));
    }
  };

  // 파일 길이 확인 및 요약 가능 페이지 수 계산
  const checkFileLength = (text: string) => {
    const charCount = text.length;
    const estimatedPages = Math.ceil(charCount / 2000); // 한 페이지당 약 2000자로 추정
    
    if (charCount > 3000) {
      const maxPages = Math.floor(3000 / 2000); // 요약 가능한 최대 페이지 수
      return {
        isLong: true,
        totalPages: estimatedPages,
        maxPages: maxPages,
        message: `파일이 ${estimatedPages}페이지로 추정됩니다. ${maxPages}페이지까지만 요약하여 처리됩니다.`
      };
    }
    
    return {
      isLong: false,
      totalPages: estimatedPages,
      maxPages: estimatedPages,
      message: ''
    };
  };

  // 파일 선택 처리 (이미지 + PDF/PPT)
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setIsProcessingImage(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.toLowerCase();
        
        console.log(`파일 ${i + 1}/${files.length} 처리 중: ${fileName}, 크기: ${file.size} bytes`);
        
        // 파일 크기 확인
        if (file.size === 0) {
          setError('빈 파일입니다.');
          continue;
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50MB 제한
          setError('파일 크기가 너무 큽니다. (최대 50MB)');
          continue;
        }
        
        if (fileName.endsWith('.pdf') || fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
          console.log('문서 파일 처리 시작:', fileName);
          const success = await processDocument(file);
          console.log('문서 파일 처리 결과:', success ? '성공' : '실패');
        } else if (file.type.startsWith('image/')) {
          console.log('이미지 파일 처리 시작:', fileName);
          const success = await processImage(file);
          console.log('이미지 파일 처리 결과:', success ? '성공' : '실패');
        } else {
          console.warn(`지원하지 않는 파일 형식: ${fileName}`);
          setError(`지원하지 않는 파일 형식입니다. 이미지(.jpg, .png, .gif), PDF(.pdf), PowerPoint(.ppt, .pptx) 파일만 지원됩니다.`);
          continue;
        }
        
        // 마지막 파일이 아니면 약간의 지연
        if (i < files.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      console.error('파일 처리 중 오류:', error);
      setError('파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingImage(false);
    }

    // 파일 입력 초기화
    event.target.value = '';
  };

  // 이미지 붙여넣기 처리
  const handleImagePaste = async (event: React.ClipboardEvent) => {
    event.preventDefault();
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    
    // 모든 이미지 파일 수집
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }
    
    console.log('발견된 이미지 파일 개수:', imageFiles.length);
    
    if (imageFiles.length === 0) {
      setError('클립보드에 이미지가 없습니다.');
      return;
    }
    
    setError('');
    setIsProcessingImage(true);
    
    try {
      // 순차적으로 처리
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        console.log(`이미지 ${i + 1}/${imageFiles.length} 처리 중...`);
        
        await processImage(file);
        
        // 마지막 이미지가 아니면 약간의 지연
        if (i < imageFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      console.error('이미지 처리 중 오류:', error);
      setError('이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  // 문서 파일 처리 (PDF/PPT)
  const processDocument = async (file: File) => {
    try {
      console.log('문서 처리 시작:', file.name, file.size, 'bytes');
      
      // 파일 크기 및 형식 재확인
      if (file.size === 0) {
        throw new Error('빈 파일입니다.');
      }
      
      if (file.size > 50 * 1024 * 1024) {
        throw new Error('파일 크기가 너무 큽니다. (최대 50MB)');
      }
      
      const fileName = file.name.toLowerCase();
      const isPDF = fileName.endsWith('.pdf');
      const isPPT = fileName.endsWith('.ppt') || fileName.endsWith('.pptx');
      
      if (!isPDF && !isPPT) {
        throw new Error('지원하지 않는 파일 형식입니다.');
      }
      
      console.log('문서 형식 확인:', { isPDF, isPPT, fileName });
      
      const formData = new FormData();
      formData.append('file', file);

      console.log('문서 OCR API 호출 중...');
      const response = await fetch('/api/document-ocr', {
        method: 'POST',
        body: formData,
      });

      console.log('API 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: 문서 처리에 실패했습니다.`;
        console.error('API 오류:', errorMessage);
        console.error('오류 데이터:', errorData);
        const combined = errorData.details ? `${errorMessage} (${errorData.details})` : errorMessage;
        throw new Error(combined);
      }
      
      const data = await response.json();
      console.log('문서 OCR API 응답:', data);
      console.log('응답 데이터 상세:', {
        success: data.success,
        totalPages: data.totalPages,
        resultsCount: data.results?.length || 0,
        successCount: data.successCount,
        errorCount: data.errorCount
      });

      if (!data.success) {
        const errorMessage = data.error || '문서에서 텍스트를 추출할 수 없습니다.';
        console.error('문서 처리 실패:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log(`총 ${data.results?.length || 0}개의 페이지 결과 처리 중...`);

      if (data.results && data.results.length > 0) {
        // 전체 텍스트 길이 확인
        const allText = data.results.map((result: any) => result.text).join('\n\n');
        console.log('추출된 전체 텍스트 길이:', allText.length);
        console.log('추출된 텍스트 미리보기:', allText.substring(0, 500) + '...');
        
        // PDF 내용 분석하여 주제 자동 설정
        console.log('🔍 PDF 내용 분석 시작...');
        const analysis = analyzePDFContent(allText);
        console.log('📊 PDF 분석 완료:', analysis);
        
        const lengthInfo = checkFileLength(allText);
        
        if (lengthInfo.isLong) {
          setError(lengthInfo.message);
        }

        data.results.forEach((result: any, index: number) => {
          console.log(`페이지 ${index + 1} 결과:`, {
            success: result.success,
            textLength: result.text?.length || 0,
            error: result.error,
            extractionMethod: result.extractionMethod,
            textPreview: result.text?.substring(0, 100) + '...'
          });
          
          if (result.success && result.text && result.text.trim().length > 0) {
            const newImage = {
              id: `doc_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
              data: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`, // 빈 이미지 플레이스홀더
              text: result.text.trim(),
              fileName: file.name,
              status: 'success' as const
            };
            
            setUploadedImages(prev => [...prev, newImage]);
            console.log(`페이지 ${index + 1} 추가 완료 (${result.extractionMethod})`);
          } else {
            console.warn(`페이지 ${index + 1} 처리 실패:`, result.error);
            // 실패한 페이지도 추가하되 오류 상태로
            const failedImage = {
              id: `doc_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
              data: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`,
              text: result.text || '텍스트 추출 실패',
              fileName: file.name,
              status: 'error' as const,
              errorMessage: result.error || '알 수 없는 오류'
            };
            setUploadedImages(prev => [...prev, failedImage]);
          }
        });
        
        // PDF 처리 결과 요약
        const successCount = data.results.filter((r: any) => r.success).length;
        const totalCount = data.results.length;
        
        if (successCount === 0) {
          setError(`PDF에서 텍스트를 추출할 수 없습니다. 
          
💡 해결 방법:
• 텍스트 기반 PDF 파일을 사용해주세요
• PDF 내용을 복사해서 텍스트로 붙여넣기 해주세요
• 이미지로 변환 후 업로드해주세요
• 다른 PDF 파일을 시도해보세요
• 처리 시간이 오래 걸릴 수 있으니 잠시 기다려주세요`);
        } else if (successCount < totalCount) {
          console.log(`PDF 처리 완료: ${successCount}/${totalCount} 페이지 성공. 일부 페이지에서 텍스트 추출에 실패했습니다.`);
          
          // 성공한 페이지들의 처리 방법 표시
          const successfulResults = data.results.filter((r: any) => r.success);
          const methods = [...new Set(successfulResults.map((r: any) => r.extractionMethod))];
          
          if (methods.length > 0) {
            console.log('사용된 처리 방법:', methods);
          }
        } else {
          console.log(`PDF 처리 완료: ${successCount}/${totalCount} 페이지 모두 성공`);
          
          // 성공한 페이지들의 처리 방법 표시
          const methods = [...new Set(data.results.map((r: any) => r.extractionMethod))];
          if (methods.length > 0) {
            console.log('사용된 처리 방법:', methods);
          }
        }
      } else {
        throw new Error('문서에서 텍스트를 추출할 수 없습니다.');
      }
      
      return true;
    } catch (error) {
      console.error('문서 처리 중 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '문서 처리 중 오류가 발생했습니다.';
      
      // 오류 이미지 추가
      const errorImage = {
        id: `doc_${Date.now()}_error_${Math.random().toString(36).substr(2, 9)}`,
        data: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`,
        text: '문서 처리 실패',
        fileName: file.name,
        status: 'error' as const,
        errorMessage: errorMessage
      };
      setUploadedImages(prev => [...prev, errorImage]);
      
      return false;
    }
  };

  // 이미지 파일 처리
  const processImage = async (file: File) => {
    let tempImageId = '';
    
    try {
      // 이미지를 base64로 변환
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result) {
            resolve(result);
          } else {
            reject(new Error('이미지 파일을 읽을 수 없습니다.'));
          }
        };
        reader.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
        reader.readAsDataURL(file);
      });

      console.log('이미지 데이터 생성 완료, 크기:', imageData.length);

      // 임시 이미지 객체 생성 (처리 중 상태)
      const tempImage = { 
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, 
        data: imageData, 
        text: '',
        fileName: file.name,
        status: 'processing' as const
      };
      
      tempImageId = tempImage.id;
      setUploadedImages(prev => [...prev, tempImage]);

      // OCR API 호출
      const response = await fetch('/api/image-ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData }),
      });

      console.log('이미지 OCR API 응답 상태:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: 이미지 처리에 실패했습니다.`;
        console.error('이미지 OCR API 오류:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('이미지 OCR API 응답:', data);
      
      if (!data.success) {
        const errorMessage = data.error || '이미지에서 텍스트를 추출할 수 없습니다.';
        console.error('이미지 OCR 실패:', errorMessage);
        throw new Error(errorMessage);
      }

      // 성공 시 이미지 상태 업데이트
      setUploadedImages(prev => prev.map(img => 
        img.id === tempImageId 
          ? { ...img, text: data.text, status: 'success' as const }
          : img
      ));
      
      return true;
    } catch (err) {
      console.error('이미지 처리 중 오류:', err);
      const errorMessage = err instanceof Error ? err.message : '이미지 처리 중 오류가 발생했습니다.';
      
      // 실패 시 이미지 상태 업데이트
      if (tempImageId) {
        setUploadedImages(prev => prev.map(img => 
          img.id === tempImageId 
            ? { ...img, status: 'error' as const, errorMessage: errorMessage }
            : img
        ));
      } else {
        // tempImageId가 없는 경우 새로운 오류 이미지 추가
        const errorImage = {
          id: `img_${Date.now()}_error_${Math.random().toString(36).substr(2, 9)}`,
          data: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`,
          text: '이미지 처리 실패',
          fileName: file.name,
          status: 'error' as const,
          errorMessage: errorMessage
        };
        setUploadedImages(prev => [...prev, errorImage]);
      }
      
      return false;
    }
  };

  // 이미지 제거
  const removeImage = (id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
    setError('');
  };

  const generateScript = async () => {
    console.log('=== 대본 생성 시작 ===');
    
    // 새 대본 생성 모드
    if (!formData.topic.trim() || !formData.audience || !formData.purpose) {
      console.error('❌ 필수 입력 항목 누락:', {
        topic: formData.topic,
        audience: formData.audience,
        purpose: formData.purpose
      });
      setError('발표 주제, 대상 청중, 발표 목적은 필수 입력 항목입니다.');
      return;
    }
    
    // 참고 자료 확인 (파일 업로드 또는 텍스트 입력 중 하나만 있으면 됨)
    const hasValidImages = uploadedImages.some(img => img.status === 'success' && img.text && img.text.trim().length > 0);
    const hasAdditionalInfo = formData.additionalInfo && formData.additionalInfo.trim().length > 0;
    
    if (!hasValidImages && !hasAdditionalInfo) {
      console.error('❌ 참고 자료가 없음');
      setError('참고 자료를 입력해주세요. PDF/이미지 파일을 업로드하거나 "참고 자료 및 추가 정보"에 내용을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 파일에서 추출된 텍스트
      const allImageText = uploadedImages
        .filter(img => img.status === 'success')
        .map(img => img.text)
        .join('\n\n');
      
      // 추가 정보 텍스트
      const additionalInfoText = formData.additionalInfo || '';
      
      // 전체 참고 자료 텍스트 (파일 + 추가 정보)
      const allReferenceText = [allImageText, additionalInfoText]
        .filter(text => text.trim().length > 0)
        .join('\n\n');
      
      // 파일 내용 추적
      setUsedFileContent(allReferenceText);
      
      console.log('📊 대본 생성 정보:', {
        mode: '새 생성',
        topic: formData.topic,
        audience: formData.audience,
        purpose: formData.purpose,
        imageTextLength: allImageText.length,
        additionalInfoLength: additionalInfoText.length,
        totalReferenceLength: allReferenceText.length,
        uploadedImagesCount: uploadedImages.length,
        successImagesCount: uploadedImages.filter(img => img.status === 'success').length,
        errorImagesCount: uploadedImages.filter(img => img.status === 'error').length,
        fileContentPreview: allReferenceText.substring(0, 200) + (allReferenceText.length > 200 ? '...' : '')
      });
      
      console.log('📄 추출된 파일 텍스트:', allImageText);
      console.log('📄 추가 정보 텍스트:', additionalInfoText);
      console.log('📄 전체 참고 자료:', allReferenceText);
      
      const body = { 
            ...formData, 
            imageText: allReferenceText || '', 
            fileContent: allReferenceText || '',
            audience: formData.audience === 'custom' ? formData.customAudience : formData.audience,
            purpose: formData.purpose === 'custom' ? formData.customPurpose : formData.purpose
          };

      console.log('📤 API 요청 본문:', {
        ...body,
        imageText: body.imageText ? `${body.imageText.substring(0, 100)}...` : '없음',
        fileContent: body.fileContent ? `${body.fileContent.substring(0, 100)}...` : '없음'
      });
      
      console.log('📤 API 요청 본문 전체 내용:', {
        imageText: body.imageText,
        fileContent: body.fileContent
      });

      console.log('🚀 API 호출 시작...');
      const response = await fetch('/api/presentation-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('📥 API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || '발표 대본 생성에 실패했습니다.';
        console.error('❌ API 오류:', errorMessage);
        console.error('❌ 응답 상태:', response.status);
        console.error('❌ 오류 데이터:', errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ API 응답 데이터 받음:', {
        hasScript: !!data.script,
        scriptLength: data.script?.length || 0
      });
      
      if (!data.script) {
        console.error('❌ 생성된 대본이 없음');
        throw new Error('생성된 대본이 없습니다.');
      }
      
      setGeneratedScript(removeMarkdownSymbols(data.script));
      console.log('🎉 대본 생성 성공, 길이:', data.script.length);
      console.log('📄 대본 미리보기:', data.script.substring(0, 200) + '...');
      
    } catch (err) {
      console.error('💥 대본 생성 중 오류:', err);
      console.error('오류 타입:', typeof err);
      console.error('오류 메시지:', err instanceof Error ? err.message : '알 수 없는 오류');
      console.error('오류 스택:', err instanceof Error ? err.stack : '스택 없음');
      
      const errorMessage = err instanceof Error ? err.message : '오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('🏁 대본 생성 완료');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedScript);
  };

  const downloadScript = async () => {
    try {
      // docx 라이브러리 동적 import
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      
      // 발표 대본을 섹션별로 분할
      const sections = removeMarkdownSymbols(generatedScript)
        .split(/(?=도입부|본론|결론)/g)
        .filter(section => section.trim());
      
      // 워드 문서 생성
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // 제목
            new Paragraph({
              text: `발표 대본: ${formData.topic || '제목없음'}`,
              heading: HeadingLevel.HEADING_1,
              spacing: { after: 400 }
            }),
            
            // 발표 정보
            new Paragraph({
              children: [
                new TextRun({ text: `발표 대상: ${formData.audience}`, bold: true }),
                new TextRun({ text: ' | ' }),
                new TextRun({ text: `발표 시간: ${formData.duration}분`, bold: true }),
                new TextRun({ text: ' | ' }),
                new TextRun({ text: `발표 목적: ${formData.purpose}`, bold: true })
              ],
              spacing: { after: 200 }
            }),
            
            // 구분선
            new Paragraph({
              children: [new TextRun({ text: '─'.repeat(50) })],
              spacing: { after: 400 }
            }),
            
            // 각 섹션 추가
            ...sections.map(section => {
              const lines = section.split('\n').filter(line => line.trim());
              if (lines.length === 0) return [];
              
              const sectionTitle = lines[0].trim();
              const sectionContent = lines.slice(1).join('\n').trim();
              
              return [
                // 섹션 제목
                new Paragraph({
                  text: sectionTitle,
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 400, after: 200 }
                }),
                
                // 섹션 내용
                new Paragraph({
                  text: sectionContent,
                  spacing: { after: 300 }
                })
              ];
            }).flat()
          ]
        }]
      });
      
      // 워드 문서 생성 및 다운로드
      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `발표대본_${formData.topic || '제목없음'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('워드 문서 생성 중 오류:', error);
      // 오류 발생 시 기존 텍스트 파일로 fallback
      const blob = new Blob([generatedScript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `발표대본_${formData.topic || '제목없음'}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // 마크다운 기호 제거 함수
  const removeMarkdownSymbols = (text: string) => {
    return text
      .replace(/^\s*[#*]+\s*/gm, '') // 줄 시작의 #, * 제거
      .replace(/\*\*(.*?)\*\*/g, '$1') // **텍스트** → 텍스트
      .replace(/\*(.*?)\*/g, '$1') // *텍스트* → 텍스트
      .replace(/^#+\s+/gm, '') // # 제목 → 제목
      .replace(/\n\s*[-*+]\s+/g, '\n• ') // - * + → •
      .replace(/\n\s*\d+\.\s+/g, '\n') // 1. 2. → 줄바꿈
      .replace(/\[([^\]]+)\]/g, '$1') // [텍스트] → 텍스트
      .trim();
  };

  // 성공한 이미지 개수
  const successCount = uploadedImages.filter(img => img.status === 'success').length;
  const errorCount = uploadedImages.filter(img => img.status === 'error').length;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-8" onClick={() => {
        setShowFileInfoPopup(false);
        setShowEmphasisInfoPopup(false);
        setShowDurationInfoPopup(false);
      }}>
        <div className="max-w-7xl mx-auto px-4">
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
            <div className="flex items-center justify-center mb-4">
              <h1 className="text-3xl font-bold text-gray-900">AI 발표 대본 생성</h1>
            </div>
            <p className="text-gray-600 text-lg mb-6">
              발표 주제, 자료, 시간을 입력하면 AI가 대본을 완성합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-8 gap-8">
            {/* 왼쪽: 발표 정보 입력 */}
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2" />
                  발표 정보 입력
                </h2>

                {/* 발표 주제 */}
                <div className="mb-6">
                  <label className="block text-base font-medium text-gray-800 mb-2">
                    <FileText className="w-4 h-4 inline mr-1" />
                    발표 주제
                  </label>
                  <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) => handleInputChange('topic', e.target.value)}
                    placeholder="예: 신제품 마케팅 전략, 프로젝트 진행 현황 보고"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-500"
                  />
                </div>

                {/* 참고 자료 및 추가 정보 */}
                <div className="mb-6">
                  <div className="flex items-center mb-2">
                    <label className="block text-base font-medium text-gray-800">
                      <FileText className="w-4 h-4 inline mr-1" />
                      참고 자료 및 추가 정보
                    </label>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowFileInfoPopup(!showFileInfoPopup);
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="파일 길이 안내"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      
                      {/* 파일 길이 안내 팝업 */}
                      {showFileInfoPopup && (
                        <div 
                          className="absolute top-full left-0 mt-1 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-64">
                            {/* 팝업 헤더 */}
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-black">파일 길이 안내</h4>
                              <button
                                onClick={() => setShowFileInfoPopup(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            
                            {/* 팝업 내용 */}
                            <div className="text-xs text-black">
                              <ul className="space-y-1">
                                <li className="flex items-start">
                                  <span className="text-blue-600 mr-2">🔹</span>
                                  <span>텍스트 3,000자 초과 시 요약 처리</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* 파일 형식 안내 */}
                  <div className="mb-2 text-xs text-gray-500">
                    이미지, PDF, PPT 형식 업로드 가능
                  </div>
                  
                  {/* 메인 입력 영역 */}
                  <div className="relative">
                    <textarea
                      value={formData.additionalInfo}
                      onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                      onPaste={handleImagePaste}
                      placeholder="참고 자료를 첨부하거나 내용을 입력해주세요."
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-500 resize-none"
                    />
                    
                    {/* 파일 첨부 버튼 (오른쪽 하단) */}
                    <div className="absolute bottom-3 right-3">
                      <button
                        onClick={() => document.getElementById('imageInput')?.click()}
                        className={`p-2 rounded-full transition-colors ${
                          true 
                            ? 'bg-blue-100 hover:bg-blue-200 text-blue-600' 
                            : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
                        }`}
                        title="파일 첨부"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* 숨겨진 파일 입력 */}
                    <input
                      id="imageInput"
                      type="file"
                      multiple
                      accept="image/*,.pdf,.ppt,.pptx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  
                  {/* 파일 처리 중 표시 */}
                  {isProcessingImage && (
                    <div className="flex items-center justify-center py-2 mt-2">
                      <RefreshCw className={`w-4 h-4 mr-2 animate-spin text-blue-600`} />
                      <span className="text-blue-600">파일 처리 중...</span>
                    </div>
                  )}
                  
                  {/* 업로드된 파일 목록 */}
                  {uploadedImages.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>첨부된 파일 ({uploadedImages.length}개)</span>
                        {successCount > 0 && (
                          <span className="text-blue-600 flex items-center">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            성공: {successCount}개
                          </span>
                        )}
                        {errorCount > 0 && (
                          <span className="text-red-600 flex items-center ml-2">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            실패: {errorCount}개
                          </span>
                        )}
                      </div>
                      
                      {uploadedImages.map((image, index) => (
                        <div key={image.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                          <div className="flex items-center">
                            {image.id.startsWith('doc_') ? (
                              <div className="w-8 h-8 bg-gray-200 rounded mr-2 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-gray-600" />
                              </div>
                            ) : (
                              <img src={image.data} alt={`업로드된 이미지 ${index + 1}`} className="w-8 h-8 object-cover rounded mr-2" />
                            )}
                            <span className="text-sm font-medium text-gray-800">
                              {image.fileName}
                            </span>
                          </div>
                          
                          {/* 상태 표시 */}
                          <div className="flex items-center">
                            {image.status === 'processing' && (
                              <div className="flex items-center text-blue-600 mr-2">
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                <span className="text-xs">처리 중</span>
                              </div>
                            )}
                            {image.status === 'success' && (
                              <div className="flex items-center text-blue-600 mr-2">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                <span className="text-xs">완료</span>
                              </div>
                            )}
                            {image.status === 'error' && (
                              <div className="flex items-center text-red-600 mr-2">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                <span className="text-xs" title={image.errorMessage || '실패'}>
                                  {image.errorMessage || '실패'}
                                </span>
                              </div>
                            )}
                            <button
                              onClick={() => removeImage(image.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 발표 시간 */}
                <div className="mb-6">
                  <div className="flex items-center mb-2">
                    <label className="block text-base font-medium text-gray-800">
                      <Clock className="w-4 h-4 inline mr-1" />
                      발표 시간
                    </label>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDurationInfoPopup(!showDurationInfoPopup);
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="발표 시간 안내"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      
                      {/* 발표 시간 안내 팝업 */}
                      {showDurationInfoPopup && (
                        <div 
                          className="absolute top-full left-0 mt-1 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-64">
                            {/* 팝업 헤더 */}
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-black">발표 시간 안내</h4>
                              <button
                                onClick={() => setShowDurationInfoPopup(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            
                            {/* 팝업 내용 */}
                            <div className="text-xs text-black">
                              발표 시간에 따라 대본의 길이가 정해집니다.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {durationOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleInputChange('duration', option.value)}
                        className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                          formData.duration === option.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 발표 대상 */}
                <div className="mb-6">
                  <label className="block text-base font-medium text-gray-800 mb-2">
                    <Users className="w-4 h-4 inline mr-1" />
                    발표 대상
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {audienceOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          handleInputChange('audience', option.value);
                          if (option.value === 'custom') {
                            // 직접 입력 버튼 클릭 시 입력 필드에 포커스
                            setTimeout(() => {
                              const input = document.getElementById('customAudienceInput');
                              if (input) input.focus();
                            }, 100);
                          }
                        }}
                        className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                          formData.audience === option.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* 직접 입력 필드 */}
                  {formData.audience === 'custom' && (
                    <div className="mt-3">
                      <input
                        id="customAudienceInput"
                        type="text"
                        value={formData.customAudience}
                        onChange={(e) => handleInputChange('customAudience', e.target.value)}
                        placeholder="발표 대상을 입력해주세요."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-500"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* 발표 목적 */}
                <div className="mb-6">
                  <label className="block text-base font-medium text-gray-800 mb-2">
                    <Target className="w-4 h-4 inline mr-1" />
                    발표 목적
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {purposeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          handleInputChange('purpose', option.value);
                          if (option.value === 'custom') {
                            // 직접 입력 버튼 클릭 시 입력 필드에 포커스
                            setTimeout(() => {
                              const input = document.getElementById('customPurposeInput');
                              if (input) input.focus();
                            }, 100);
                          }
                        }}
                        className={`p-3 border rounded-lg text-sm font-medium transition-colors ${
                          formData.purpose === option.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-blue-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  
                  {/* 직접 입력 필드 */}
                  {formData.purpose === 'custom' && (
                    <div className="mt-3">
                      <input
                        id="customPurposeInput"
                        type="text"
                        value={formData.customPurpose}
                        onChange={(e) => handleInputChange('customPurpose', e.target.value)}
                        placeholder="발표 목적을 입력해주세요."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-500"
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                {/* 강조 포인트 */}
                <div className="mb-6">
                  <div className="flex items-center mb-2">
                    <label className="block text-base font-medium text-gray-800">
                      <Lightbulb className="w-4 h-4 inline mr-1" />
                      강조 포인트 (선택사항)
                    </label>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEmphasisInfoPopup(!showEmphasisInfoPopup);
                        }}
                        className="ml-2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        title="강조 포인트 안내"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      
                      {/* 강조 포인트 안내 팝업 */}
                      {showEmphasisInfoPopup && (
                        <div 
                          className="absolute top-full left-0 mt-1 z-50"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-64">
                            {/* 팝업 헤더 */}
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-black">강조 포인트 안내</h4>
                              <button
                                onClick={() => setShowEmphasisInfoPopup(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            
                            {/* 팝업 내용 */}
                            <div className="text-xs text-black">
                              발표에서 꼭 전달하고 싶은 핵심 내용을 적어주세요. (예 : "매출 성장 요인", "AI 도입 효과")
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {formData.keyPoints.map((point, index) => (
                    <div key={index} className="flex items-center mb-2">
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => handleKeyPointChange(index, e.target.value)}
                        placeholder="강조 포인트를 입력해주세요."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-500"
                      />
                      {formData.keyPoints.length > 1 && (
                        <button
                          onClick={() => removeKeyPoint(index)}
                          className="ml-2 p-2 text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addKeyPoint}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    포인트 추가
                  </button>
                </div>
                
                {/* 오류 메시지 */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-red-600 text-sm">
                        <p className="font-medium mb-1">❌ 발표 대본 생성 실패</p>
                        <p className="mb-2">{error}</p>
                        <div className="text-xs text-red-500">
                          <p className="font-medium mb-1">💡 해결 방법:</p>
                          <ul className="space-y-1">
                            {error.includes('할당량') && (
                              <li>• OpenAI API 할당량이 부족합니다. 잠시 후 다시 시도해주세요.</li>
                            )}
                            {error.includes('속도 제한') && (
                              <li>• API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.</li>
                            )}
                            {error.includes('인증') && (
                              <li>• OpenAI API 키 설정을 확인해주세요.</li>
                            )}
                            {error.includes('토큰') || error.includes('참고 자료가 너무 깁니다') && (
                              <li>• 더 짧은 참고 자료로 다시 시도해주세요.</li>
                            )}
                            {error.includes('타임아웃') && (
                              <li>• 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.</li>
                            )}
                            {error.includes('네트워크') && (
                              <li>• 인터넷 연결을 확인해주세요.</li>
                            )}
                            {!error.includes('할당량') && !error.includes('속도 제한') && !error.includes('인증') && !error.includes('토큰') && !error.includes('타임아웃') && !error.includes('네트워크') && (
                              <li>• 잠시 후 다시 시도해주세요.</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 대본 생성 버튼 */}
                <div className="relative">
                  <button
                    onClick={generateScript}
                    disabled={isLoading || (!uploadedImages.some(img => img.status === 'success' && img.text && img.text.trim().length > 0) && !formData.additionalInfo?.trim())}
                    className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center transition-colors ${
                      isLoading || (!uploadedImages.some(img => img.status === 'success' && img.text && img.text.trim().length > 0) && !formData.additionalInfo?.trim())
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                    title={(!uploadedImages.some(img => img.status === 'success' && img.text && img.text.trim().length > 0) && !formData.additionalInfo?.trim()) 
                      ? '참고 자료를 입력해주세요 (파일 업로드 또는 텍스트 입력)' 
                      : ''
                    }
                  >
                    {isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        발표 대본 생성하기
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 오른쪽: 생성된 발표 대본 */}
            <div className="lg:col-span-5 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                생성된 발표 대본
              </h2>
              
              {generatedScript ? (
                <div className="space-y-4">
                  {/* 파일 내용 사용 여부 표시 */}
                  {usedFileContent && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start">
                        <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">📄 업로드된 파일 내용이 대본 생성에 사용되었습니다</p>
                          <p className="text-xs text-blue-600">
                            파일 길이: {usedFileContent.length}자 | 
                            처리된 페이지: {Math.ceil(usedFileContent.length / 2000)}페이지
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* PDF 처리 실패 시 상세 정보 */}
                  {uploadedImages.length > 0 && uploadedImages.every(img => img.status === 'error') && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm text-red-800">
                          <p className="font-medium mb-1">⚠️ PDF 처리 실패</p>
                          <p className="text-xs text-red-600 mb-2">
                            PDF 파일을 인식하지 못했습니다. 다음을 확인해주세요:
                          </p>
                          <ul className="text-xs text-red-600 space-y-1">
                            <li>• <strong>암호화된 PDF</strong>: 비밀번호를 제거한 후 다시 시도</li>
                            <li>• <strong>이미지 기반 PDF</strong>: 텍스트 기반 PDF 파일 사용</li>
                            <li>• <strong>스캔된 PDF</strong>: OCR 기능이 있는 PDF 변환 도구 사용</li>
                            <li>• <strong>파일 크기</strong>: 50MB 이하인지 확인</li>
                            <li>• <strong>파일 형식</strong>: 텍스트 기반 PDF인지 확인</li>
                            <li>• <strong>대안</strong>: PDF 내용을 텍스트로 복사해서 붙여넣기</li>
                            <li>• <strong>PDF 변환</strong>: Adobe Acrobat, PDF24 등으로 텍스트 추출</li>
                            <li>• <strong>온라인 도구</strong>: SmallPDF, ILovePDF 등 OCR 서비스 이용</li>
                          </ul>
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                            <p className="font-medium mb-1">💡 빠른 해결 방법:</p>
                            <p>1. PDF 파일을 열어서 텍스트를 복사</p>
                            <p>2. 복사한 텍스트를 "추가 정보"에 붙여넣기</p>
                            <p>3. 발표 대본 생성하기</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* PDF 인식은 되었지만 품질이 낮은 경우 */}
                  {uploadedImages.length > 0 && uploadedImages.some(img => img.status === 'success') && 
                   uploadedImages.some(img => img.status === 'error') && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                      <div className="flex items-start">
                        <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm text-yellow-800">
                          <p className="font-medium mb-1">⚠️ PDF 일부 처리 실패</p>
                          <p className="text-xs text-yellow-600 mb-2">
                            PDF는 인식되었지만 일부 페이지에서 텍스트 추출에 실패했습니다.
                          </p>
                          <p className="text-xs text-yellow-600">
                            성공한 페이지의 내용으로 대본을 생성합니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 rounded-lg p-4 max-h-[600px] overflow-y-auto">
                    <div className="text-sm text-gray-800">
                      {removeMarkdownSymbols(generatedScript)
                        .split(/(?=도입부|본론|결론)/g)  // 실제 제목 패턴으로 분할
                        .filter(paragraph => paragraph.trim())  // 빈 문단 제거
                        .map((paragraph, idx) => (
                          <p key={idx} className="mb-4 whitespace-pre-line">
                            {paragraph.trim()}
                          </p>
                        ))}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={copyToClipboard}
                      className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      복사
                    </button>
                    <button
                      onClick={downloadScript}
                      className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      다운로드
                    </button>
                  </div>
                </div>
              ) : isLoading ? (
                <div className="text-center py-12">
                  <div className="flex items-center justify-center mb-4">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                  </div>
                  <p className="text-blue-600 font-medium">발표 대본 생성 중...</p>
                  <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요.</p>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Presentation className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>발표 대본이 여기에 표시됩니다.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 