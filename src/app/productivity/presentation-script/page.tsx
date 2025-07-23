"use client";
import { useState } from "react";
import Header from '../../components/Header';
import { Presentation, Clock, Users, Target, Lightbulb, FileText, Download, Copy, RefreshCw, Upload, FileCheck, X, Plus, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function PresentationScript() {
  const [formData, setFormData] = useState({
    topic: '',
    duration: '10',
    audience: '',
    purpose: '',
    keyPoints: [''],
    tone: '',
    additionalInfo: ''
  });
  
  const [generatedScript, setGeneratedScript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 이미지 업로드 관련 상태
  const [uploadedImages, setUploadedImages] = useState<Array<{
    id: string, 
    data: string, 
    text: string,
    status: 'processing' | 'success' | 'error',
    errorMessage?: string
  }>>([]);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isFileMode, setIsFileMode] = useState(false);
  
  // 파일 내용 사용 여부 추적
  const [usedFileContent, setUsedFileContent] = useState<string>('');

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
    
    // 주제 자동 설정
    if (detectedTitle) {
      const newTopic = detectedTitle.includes('Chapter') ? detectedTitle : `Chapter: ${detectedTitle}`;
      setFormData(prev => ({
        ...prev,
        topic: newTopic
      }));
      console.log('✅ 주제 자동 설정:', newTopic);
    }
    
    return { detectedTitle, author, objectives };
  };

  const durationOptions = [
    { value: '5', label: '5분' },
    { value: '10', label: '10분' },
    { value: '15', label: '15분' },
    { value: '20', label: '20분' },
    { value: '30', label: '30분' },
    { value: '45', label: '45분' },
    { value: '60', label: '1시간' }
  ];

  const audienceOptions = [
    { value: 'colleagues', label: '동료/팀원' },
    { value: 'executives', label: '경영진/상급자' },
    { value: 'clients', label: '고객/클라이언트' },
    { value: 'students', label: '학생/수강생' },
    { value: 'general', label: '일반 대중' },
    { value: 'professionals', label: '전문가/업계 관계자' },
    { value: 'investors', label: '투자자/파트너' }
  ];

  const purposeOptions = [
    { value: 'inform', label: '정보 전달' },
    { value: 'persuade', label: '설득/제안' },
    { value: 'educate', label: '교육/훈련' },
    { value: 'entertain', label: '오락/흥미 유발' },
    { value: 'motivate', label: '동기부여/격려' },
    { value: 'report', label: '보고/상황 전달' },
    { value: 'present', label: '제품/서비스 소개' }
  ];

  const toneOptions = [
    { value: 'professional', label: '전문적/공식적' },
    { value: 'casual', label: '친근/편안한' },
    { value: 'enthusiastic', label: '열정적/에너지 넘치는' },
    { value: 'calm', label: '차분/신뢰감 있는' },
    { value: 'humorous', label: '유머러스/재미있는' },
    { value: 'inspirational', label: '영감을 주는/격려하는' },
    { value: 'authoritative', label: '권위적/확신에 찬' }
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
        throw new Error(errorMessage);
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

  // 모드 변경
  const switchMode = (mode: 'create' | 'improve') => {
    setIsFileMode(mode === 'improve');
    setGeneratedScript('');
    setError('');
    setUsedFileContent(''); // 파일 내용 추적 상태도 초기화
  };

  const generateScript = async () => {
    console.log('=== 대본 생성 시작 ===');
    
    if (isFileMode) {
      // 파일 개선 모드
      if (uploadedImages.length === 0) {
        console.error('❌ 개선할 이미지가 없음');
        setError('먼저 개선할 이미지를 붙여넣거나 업로드해주세요.');
        return;
      }
    } else {
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
    }

    setIsLoading(true);
    setError('');

    try {
      const endpoint = isFileMode ? '/api/presentation-script/improve' : '/api/presentation-script';
      const allImageText = uploadedImages
        .filter(img => img.status === 'success')
        .map(img => img.text)
        .join('\n\n');
      
      // 파일 내용 추적
      setUsedFileContent(allImageText);
      
      console.log('📊 대본 생성 정보:', {
        mode: isFileMode ? '개선' : '새 생성',
        endpoint,
        topic: formData.topic,
        audience: formData.audience,
        purpose: formData.purpose,
        imageTextLength: allImageText.length,
        uploadedImagesCount: uploadedImages.length,
        successImagesCount: uploadedImages.filter(img => img.status === 'success').length,
        errorImagesCount: uploadedImages.filter(img => img.status === 'error').length,
        fileContentPreview: allImageText.substring(0, 200) + (allImageText.length > 200 ? '...' : '')
      });
      
      console.log('📄 추출된 파일 텍스트 전체 내용:', allImageText);
      console.log('📄 성공한 이미지들:', uploadedImages.filter(img => img.status === 'success').map(img => ({
        id: img.id,
        textLength: img.text?.length || 0,
        textPreview: img.text?.substring(0, 100) + (img.text?.length > 100 ? '...' : '')
      })));
      
      const body = isFileMode 
        ? { imageText: allImageText, fileContent: allImageText, formData }
        : { ...formData, imageText: allImageText || '', fileContent: allImageText || '' };

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
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('📥 API 응답 상태:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `${isFileMode ? '대본 개선' : '발표 대본 생성'}에 실패했습니다.`;
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
      
      setGeneratedScript(data.script);
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

  const downloadScript = () => {
    const blob = new Blob([generatedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `발표대본_${formData.topic || '제목없음'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 성공한 이미지 개수
  const successCount = uploadedImages.filter(img => img.status === 'success').length;
  const errorCount = uploadedImages.filter(img => img.status === 'error').length;

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* 헤더 */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <Presentation className="w-12 h-12 text-blue-600 mr-3" />
              <h1 className="text-3xl font-bold text-gray-900">AI 발표 대본 생성</h1>
            </div>
            <p className="text-gray-600 text-lg mb-6">
              새로운 발표 대본을 생성하거나 기존 대본을 개선할 수 있습니다. 이미지를 붙여넣어 참고 자료로 활용할 수 있습니다.
            </p>
            
            {/* 모드 선택 버튼 */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <button
                onClick={() => switchMode('create')}
                className={`px-6 py-3 rounded-lg font-medium flex items-center transition-colors ${
                  !isFileMode 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <FileText className="w-4 h-4 mr-2" />
                새 대본 생성
              </button>
              <button
                onClick={() => switchMode('improve')}
                className={`px-6 py-3 rounded-lg font-medium flex items-center transition-colors ${
                  isFileMode 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <FileCheck className="w-4 h-4 mr-2" />
                기존 대본 개선
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 왼쪽: 발표 정보 입력 */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <Lightbulb className="w-5 h-5 mr-2" />
                  발표 정보 입력
                </h2>

                {/* 참고 자료 이미지 업로드 */}
                <div className="mb-6">
                  <h3 className={`text-lg font-medium mb-3 flex items-center ${
                    isFileMode ? 'text-green-800' : 'text-blue-800'
                  }`}>
                    <Upload className="w-5 h-5 mr-2" />
                    {isFileMode ? '대본 이미지 업로드' : '참고 자료 이미지 (선택사항)'}
                  </h3>
                  
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      이미지, PDF, PowerPoint 파일을 붙여넣기(Ctrl+V)하거나 파일을 선택하세요
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                      <div className="flex items-start">
                        <Info className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">📄 파일 길이 안내</p>
                          <ul className="space-y-1 text-xs">
                            <li>• <strong>3,000자 이하</strong>: 전체 내용 처리</li>
                            <li>• <strong>3,000자 초과</strong>: 1-2페이지까지만 요약 처리</li>
                            <li>• <strong>PDF/PPT</strong>: 페이지 수 자동 계산</li>
                            <li>• <strong>이미지</strong>: 텍스트 길이 기준</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {/* 파일 선택 영역 */}
                    <div 
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                        isFileMode 
                          ? 'border-green-300 bg-green-50 hover:bg-green-100' 
                          : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                      }`}
                      onClick={() => document.getElementById('imageInput')?.click()}
                      tabIndex={0}
                    >
                      <div className="flex flex-col items-center justify-center pt-3 pb-4">
                        <Upload className={`w-6 h-6 mb-1 ${isFileMode ? 'text-green-500' : 'text-blue-500'}`} />
                        <p className={`text-sm ${isFileMode ? 'text-green-700' : 'text-blue-700'}`}>
                          <span className="font-semibold">파일 선택</span>
                        </p>
                        <p className={`text-xs ${isFileMode ? 'text-green-600' : 'text-blue-600'}`}>
                          클릭하여 파일 선택 (이미지, PDF, PPT)
                        </p>
                      </div>
                    </div>
                    
                    {/* 붙여넣기 영역 */}
                    <div 
                      className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg transition-colors ${
                        isFileMode 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-blue-300 bg-blue-50'
                      }`}
                      onPaste={handleImagePaste}
                      tabIndex={0}
                    >
                      <div className="flex flex-col items-center justify-center pt-3 pb-4">
                        <Plus className={`w-6 h-6 mb-1 ${isFileMode ? 'text-green-500' : 'text-blue-500'}`} />
                        <p className={`text-sm ${isFileMode ? 'text-green-700' : 'text-blue-700'}`}>
                          <span className="font-semibold">붙여넣기</span>
                        </p>
                        <p className={`text-xs ${isFileMode ? 'text-green-600' : 'text-blue-600'}`}>
                          Ctrl+V로 이미지 붙여넣기 (PDF/PPT는 파일 선택만 가능)
                        </p>
                      </div>
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
                    
                    {isProcessingImage && (
                      <div className="flex items-center justify-center py-2">
                        <RefreshCw className={`w-4 h-4 mr-2 animate-spin ${isFileMode ? 'text-green-600' : 'text-blue-600'}`} />
                        <span className={isFileMode ? 'text-green-600' : 'text-blue-600'}>파일 처리 중...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* 업로드된 이미지 목록 */}
                  {uploadedImages.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>업로드된 이미지 ({uploadedImages.length}개)</span>
                        {successCount > 0 && (
                          <span className="text-green-600 flex items-center">
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
                                {image.id.startsWith('doc_') ? `문서 페이지 ${index + 1}` : `이미지 ${index + 1}`}
                              </span>
                            
                            {/* 상태 표시 */}
                            <div className="ml-2">
                              {image.status === 'processing' && (
                                <div className="flex items-center text-blue-600">
                                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                  <span className="text-xs">처리 중</span>
                                </div>
                              )}
                              {image.status === 'success' && (
                                <div className="flex items-center text-green-600">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  <span className="text-xs">텍스트 추출 완료</span>
                                </div>
                              )}
                              {image.status === 'error' && (
                                <div className="flex items-center text-red-600">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  <span className="text-xs" title={image.errorMessage || '추출 실패'}>
                                    {image.errorMessage || '추출 실패'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeImage(image.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* 발표 주제 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    <FileText className="w-4 h-4 inline mr-1" />
                    발표 주제 {!isFileMode && '*'}
                  </label>
                  <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) => handleInputChange('topic', e.target.value)}
                    placeholder={isFileMode ? "개선된 대본의 주제 (선택사항)" : "예: 신제품 마케팅 전략, 프로젝트 진행 현황 보고"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-500"
                  />
                </div>

                {/* 발표 시간 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    발표 시간
                  </label>
                  <select
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  >
                    {durationOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 대상 청중 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    <Users className="w-4 h-4 inline mr-1" />
                    대상 청중 {!isFileMode && '*'}
                  </label>
                  <select
                    value={formData.audience}
                    onChange={(e) => handleInputChange('audience', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  >
                    <option value="">청중을 선택하세요</option>
                    {audienceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 발표 목적 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    <Target className="w-4 h-4 inline mr-1" />
                    발표 목적 {!isFileMode && '*'}
                  </label>
                  <select
                    value={formData.purpose}
                    onChange={(e) => handleInputChange('purpose', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  >
                    <option value="">목적을 선택하세요</option>
                    {purposeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 주요 포인트 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    <Lightbulb className="w-4 h-4 inline mr-1" />
                    주요 포인트 (선택사항)
                  </label>
                  {formData.keyPoints.map((point, index) => (
                    <div key={index} className="flex items-center mb-2">
                      <input
                        type="text"
                        value={point}
                        onChange={(e) => handleKeyPointChange(index, e.target.value)}
                        placeholder={`주요 포인트 ${index + 1}`}
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

                {/* 발표 톤 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    발표 톤 (선택사항)
                  </label>
                  <select
                    value={formData.tone}
                    onChange={(e) => handleInputChange('tone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  >
                    <option value="">톤을 선택하세요</option>
                    {toneOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 추가 정보 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-800 mb-2">
                    추가 정보 (선택사항)
                  </label>
                  <textarea
                    value={formData.additionalInfo}
                    onChange={(e) => handleInputChange('additionalInfo', e.target.value)}
                    placeholder="발표에 포함하고 싶은 추가 정보나 특별한 요구사항을 입력하세요. PDF 처리에 실패한 경우, PDF 내용을 여기에 복사해서 붙여넣기 해주세요."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-500"
                  />
                  {uploadedImages.length > 0 && uploadedImages.every(img => img.status === 'error') && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                      <p className="font-medium mb-1">💡 PDF 처리 실패 시 대안:</p>
                      <p>1. PDF 파일을 열어서 텍스트를 선택하고 복사 (Ctrl+A, Ctrl+C)</p>
                      <p>2. 위의 "추가 정보"란에 붙여넣기 (Ctrl+V)</p>
                      <p>3. 발표 대본 생성하기 버튼을 클릭</p>
                    </div>
                  )}
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
                <button
                  onClick={generateScript}
                  disabled={isLoading}
                  className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center transition-colors ${
                    isLoading
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      {isFileMode ? '대본 개선하기' : '발표 대본 생성하기'}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 오른쪽: 생성된 발표 대본 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Presentation className="w-5 h-5 mr-2" />
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
                  
                  <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                      {generatedScript}
                    </pre>
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