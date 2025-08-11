"use client";
import { useState, useEffect, useRef } from "react";
import Image from 'next/image';
import Header from '../../components/Header';
import { 
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  ArrowLeft, Presentation, Copy, Loader2, CheckCircle, AlertCircle, FileText, Download,
  Lightbulb, Target, Brain, Eye, Image as ImageIcon, Edit3, 
  Plus, Minus, BookOpen, Camera, Monitor, Palette, Layout, Sparkles,
  ChevronLeft, ChevronRight, EyeOff, Download as DownloadIcon,
  Trash2, Move, GripVertical, Type, BarChart3, PieChart, Heart,
  HelpCircle, X
} from 'lucide-react';
import { useRouter } from 'next/navigation';

// 감마 AI 스타일 템플릿 정의
const gammaTemplates = [
  {
    id: 'modern',
    name: '모던',
    description: '깔끔하고 현대적인 디자인',
    preview: 'bg-gradient-to-br from-blue-500 to-purple-600',
    colors: { primary: '#3B82F6', secondary: '#8B5CF6', accent: '#F59E0B' }
  },
  {
    id: 'creative',
    name: '크리에이티브',
    description: '창의적이고 생동감 있는 디자인',
    preview: 'bg-gradient-to-br from-pink-500 to-orange-500',
    colors: { primary: '#EC4899', secondary: '#F97316', accent: '#10B981' }
  },
  {
    id: 'professional',
    name: '프로페셔널',
    description: '비즈니스에 적합한 전문적인 디자인',
    preview: 'bg-gradient-to-br from-gray-700 to-gray-900',
    colors: { primary: '#374151', secondary: '#1F2937', accent: '#F59E0B' }
  },
  {
    id: 'vibrant',
    name: '바이브런트',
    description: '활기찬 색상과 애니메이션',
    preview: 'bg-gradient-to-br from-green-400 to-blue-500',
    colors: { primary: '#10B981', secondary: '#3B82F6', accent: '#F59E0B' }
  }
];

// 슬라이드 레이아웃 타입
const slideLayouts = [
  { id: 'title', name: '제목', icon: Type, description: '메인 제목 슬라이드' },
  { id: 'content', name: '내용', icon: FileText, description: '텍스트 중심 슬라이드' },
  { id: 'image', name: '이미지', icon: ImageIcon, description: '이미지 중심 슬라이드' },
  { id: 'chart', name: '차트', icon: BarChart3, description: '데이터 시각화' },
  { id: 'split', name: '분할', icon: Layout, description: '텍스트와 이미지 분할' },
  { id: 'timeline', name: '타임라인', icon: BarChart, description: '시간 순서 표시' },
  { id: 'comparison', name: '비교', icon: BarChart3, description: '두 항목 비교' },
  { id: 'image-heavy', name: '이미지 중심', icon: ImageIcon, description: '이미지가 주가 되는 슬라이드' },
  { id: 'grid-cards', name: '그리드 카드', icon: Layout, description: '2x2 또는 3x3 그리드 카드' },
  { id: 'checklist', name: '체크리스트', icon: CheckCircle, description: '체크리스트 형태' },
  { id: 'steps', name: '단계별', icon: List, description: '단계별 가이드' },
  { id: 'summary-with-image', name: '요약+이미지', icon: ImageIcon, description: '핵심 포인트와 이미지' }
];

interface GammaSlide {
  id: string;
  title: string;
  content: string[];
  notes?: string;
  layout: string;
  template: string;
  order: number;
}

interface GammaAISlideViewerProps {
  slides: GammaSlide[];
  onClose: () => void;
}

export default function PPTDraft() {
  const router = useRouter();
  
  // 감마 AI 스타일 상태
  const [isGammaMode, setIsGammaMode] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(gammaTemplates[0]);
  const [slides, setSlides] = useState<GammaSlide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(true);
  const [showNotes, setShowNotes] = useState(true);

  
  // 드래그 앤 드롭 상태
  const [draggedSlide, setDraggedSlide] = useState<string | null>(null);
  const [dragOverSlide, setDragOverSlide] = useState<string | null>(null);
  
  // 편집 상태
  const [editingSlide, setEditingSlide] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // 다운로드 상태
  const [downloading, setDownloading] = useState(false);
  
  // 기존 PPT 상태 (숨김)
  const [topic, setTopic] = useState('');
  const [presentationType, setPresentationType] = useState('business');
  const [targetAudience, setTargetAudience] = useState('');
  const [duration, setDuration] = useState('15');
  const [keyPoints, setKeyPoints] = useState('');
  const [objectives, setObjectives] = useState('');
  const [emphasisPoints, setEmphasisPoints] = useState('');
  const [pptResult, setPptResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 추가된 발표 가능 수준 필드들
  const [presentationStructure, setPresentationStructure] = useState('problem-solution');
  const [expectedQuestions, setExpectedQuestions] = useState('');
  const [showReferencePopup, setShowReferencePopup] = useState(false);

  // 팝업 외부 클릭 감지를 위한 ref
  const popupRef = useRef<HTMLDivElement>(null);

  // 팝업 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowReferencePopup(false);
      }
    };

    if (showReferencePopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReferencePopup]);

  // PPT 다운로드 함수
  const downloadPPT = async () => {
    if (!slides || slides.length === 0) {
      alert('다운로드할 PPT가 없습니다. 먼저 AI로 PPT를 생성해주세요.');
      return;
    }

    setDownloading(true);
    try {
      // 감마 슬라이드를 실제 PPT 형식으로 변환 (웹 프리뷰와 동일하게)
      const pptData = {
        title: topic || 'AI 생성 프레젠테이션',
        subtitle: 'AI가 생성한 프레젠테이션',
        slides: slides.map((slide: GammaSlide, index: number) => ({
          id: index + 1,
          title: slide.title,
          content: slide.content,
          notes: slide.notes || '',
          chapterId: Math.floor(index / 3) + 1,
          layout: slide.layout || 'content',
          // 웹 프리뷰와 동일한 템플릿 정보 추가
          template: slide.template || selectedTemplate.id,
          primaryColor: selectedTemplate.colors.primary,
          secondaryColor: selectedTemplate.colors.secondary,
          accentColor: selectedTemplate.colors.accent
        })),
        chapters: [
          { id: 1, title: "서론", description: "주제 소개 및 배경", color: "#3B82F6" },
          { id: 2, title: "본론", description: "핵심 내용 및 분석", color: "#10B981" },
          { id: 3, title: "결론", description: "요약 및 제안", color: "#F59E0B" }
        ],
        designOptions: {
          theme: selectedTemplate.id,
          language: 'ko',
          colorScheme: 'modern',
          // 웹 프리뷰와 동일한 디자인 옵션
          template: selectedTemplate,
          colors: selectedTemplate.colors
        }
      };

      // 디버깅: 전달되는 데이터 확인
      console.log('🔍 다운로드용 PPT 데이터:', pptData);
      console.log('🔍 웹 프리뷰용 slides:', slides);
      
      // PPT 파일 생성 API 호출 (바이너리 직접 받기)
      const response = await fetch('/api/ppt-file-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pptData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PPT 파일 생성에 실패했습니다.');
      }

      // PPT 바이너리 데이터 받기
      const pptBlob = await response.blob();
      
      // 파일 다운로드
      const fileName = `${topic || 'AI_Presentation'}_AI_Presentation.pptx`;
      const downloadUrl = window.URL.createObjectURL(pptBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      alert('PPT 파일이 성공적으로 생성되었습니다. 다운로드가 시작됩니다.');
    } catch (error) {
      console.error('PPT 다운로드 오류:', error);
      alert('PPT 파일 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setDownloading(false);
    }
  };

  // 감마 AI 모드 토글
  const toggleGammaMode = async () => {
    if (!isGammaMode) {
      // 감마 AI 모드로 전환 시 사용자 입력을 바탕으로 AI가 PPT 생성
      if (!topic.trim()) {
        alert('PPT 주제를 먼저 입력해주세요.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 기존 PPT 생성 API 호출
        const response = await fetch('/api/ppt-draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topic,
            presentationType,
            targetAudience,
            duration,
            keyPoints,
            objectives,
            emphasisPoints,
            // 추가된 발표 가능 수준 필드들
            presentationStructure,
            expectedQuestions
          }),
        });

        const data = await response.json();

        if (data.success && data.result) {
          // API 결과를 감마 슬라이드 형식으로 변환
          const generatedSlides: GammaSlide[] = data.result.slides.map((slide: any, index: number) => ({
            id: (index + 1).toString(),
            title: slide.title,
            content: slide.content,
            notes: slide.notes,
            layout: slide.layout || 'content',
            template: selectedTemplate.id,
            order: index
          }));

          setSlides(generatedSlides);
          setPptResult({
            ...data.result,
            slides: generatedSlides // ✅ 사용자 수정 기준으로 동기화
          });
          setSuccessMessage('AI가 구체적이고 실무적인 내용을 포함한 PPT를 생성했습니다! 이제 실시간 편집과 프리뷰를 경험해보세요.');
        } else {
          throw new Error(data.error || 'PPT 생성에 실패했습니다.');
        }
      } catch (err) {
        console.error('감마 모드 PPT 생성 오류:', err);
        setError(err instanceof Error ? err.message : 'PPT 생성 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
    
    setIsGammaMode(!isGammaMode);
  };

  // 슬라이드 추가
  const addSlide = (layout: string = 'content') => {
    const newSlide: GammaSlide = {
      id: Date.now().toString(),
      title: '새 슬라이드',
      content: ['내용을 입력하세요'],
      notes: '',
      layout,
      template: selectedTemplate.id,
      order: slides.length
    };
    setSlides([...slides, newSlide]);
  };

  // 슬라이드 삭제
  const deleteSlide = (slideId: string) => {
    setSlides(slides.filter(slide => slide.id !== slideId));
    if (currentSlideIndex >= slides.length - 1) {
      setCurrentSlideIndex(Math.max(0, slides.length - 2));
    }
  };

  // 슬라이드 순서 변경 (드래그 앤 드롭)
  const handleDragStart = (slideId: string) => {
    setDraggedSlide(slideId);
  };

  const handleDragOver = (e: React.DragEvent, slideId: string) => {
    e.preventDefault();
    setDragOverSlide(slideId);
  };

  const handleDrop = (e: React.DragEvent, targetSlideId: string) => {
    e.preventDefault();
    if (draggedSlide && draggedSlide !== targetSlideId) {
      const draggedIndex = slides.findIndex(s => s.id === draggedSlide);
      const targetIndex = slides.findIndex(s => s.id === targetSlideId);
      
      const newSlides = [...slides];
      const [draggedSlideData] = newSlides.splice(draggedIndex, 1);
      newSlides.splice(targetIndex, 0, draggedSlideData);
      
      // order 재정렬
      newSlides.forEach((slide, index) => {
        slide.order = index;
      });
      
      setSlides(newSlides);
    }
    setDraggedSlide(null);
    setDragOverSlide(null);
  };



  // 키보드 단축키
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!isGammaMode) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          setCurrentSlideIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowRight':
          setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [isGammaMode, slides.length]);

  // 감마 AI 모드가 아닐 때는 기존 UI 표시
  if (!isGammaMode) {
    return (
      <>
        <Header />
        <div className="min-h-screen bg-gray-50">
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
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
                <h1 className="text-3xl font-bold text-gray-900">AI PPT 생성</h1>
                <p className="text-gray-600 text-lg mt-2">
                  발표 주제와 정보를 입력하면 AI가 전문적인 PPT를 생성해드립니다.
                </p>
              </div>

              {/* PPT 생성 폼 */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">PPT 정보 입력</h2>
                  {/* 감마 AI 모드에서 다운로드 버튼 */}
                  {isGammaMode && slides.length > 0 && (
                    <button
                      onClick={downloadPPT}
                      disabled={downloading}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="PPT 파일 다운로드"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {downloading ? '생성 중...' : 'PPT 다운로드'}
                    </button>
                  )}
                </div>

                
                {/* 에러 메시지 */}
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                      <span className="text-red-700">{error}</span>
                    </div>
                  </div>
                )}
                
                {/* 성공 메시지 */}
                {successMessage && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      <span className="text-green-700">{successMessage}</span>
                    </div>
                  </div>
                )}
                
                {/* 입력 폼 */}
                {/* 기본 정보 섹션 */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Target className="w-5 h-5 mr-2 text-blue-500" />
                    기본 정보
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        발표 주제 *
                      </label>
                      <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="예: AI 도입이 중소기업에 미치는 영향"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        구체적인 주제를 입력하면 AI가 자동으로 상세한 내용을 생성합니다
                      </p>
                    </div>
                    

                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        발표 유형
                      </label>
                      <select
                        value={presentationType}
                        onChange={(e) => setPresentationType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="business">비즈니스</option>
                        <option value="academic">학술</option>
                        <option value="creative">창의적</option>
                        <option value="technical">기술</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        대상 청중
                      </label>
                      <input
                        type="text"
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        placeholder="예: 중소기업 경영진"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        발표 시간 (분)
                      </label>
                      <input
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        min="5"
                        max="60"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    

                  </div>
                </div>
                
                {/* 발표 구조 섹션 */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <List className="w-5 h-5 mr-2 text-green-500" />
                    발표 구조
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        발표 구조
                      </label>
                      <select
                        value={presentationStructure}
                        onChange={(e) => setPresentationStructure(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="problem-solution">문제제기 → 해결책 → 결과</option>
                        <option value="story">스토리텔링</option>
                        <option value="chronological">시간순서</option>
                        <option value="comparison">비교 분석</option>
                        <option value="process">프로세스 설명</option>
                        <option value="benefits">혜택 중심</option>
                      </select>
                    </div>
                    

                    

                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        예상 질문
                      </label>
                      <input
                        type="text"
                        value={expectedQuestions}
                        onChange={(e) => setExpectedQuestions(e.target.value)}
                        placeholder="예상되는 질문이나 반대 의견"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      핵심 내용
                    </label>
                    <textarea
                      value={keyPoints}
                      onChange={(e) => setKeyPoints(e.target.value)}
                      placeholder="예: AI 도입의 장점, 성공 사례, 도입 단계, 예상 효과 등"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      주요 포인트를 입력하면 AI가 더 구체적이고 관련성 높은 내용을 생성합니다
                    </p>
                  </div>
                </div>
                

                
                {/* 애니메이션 및 효과 섹션 */}

                {/* 발표 목표 및 강조 요소 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      발표 목표
                    </label>
                    <textarea
                      value={objectives}
                      onChange={(e) => setObjectives(e.target.value)}
                      placeholder="발표를 통해 달성하고자 하는 목표"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      강조 요소
                    </label>
                    <textarea
                      value={emphasisPoints}
                      onChange={(e) => setEmphasisPoints(e.target.value)}
                      placeholder="예: 비용 효율성, 성공 사례, 실무 적용 방안"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      강조하고 싶은 내용을 입력하면 해당 부분을 더 상세하게 다룹니다
                    </p>
                  </div>
                </div>
                

                
                <button
                  onClick={toggleGammaMode}
                  disabled={loading || !topic.trim()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      AI가 구체적인 내용을 포함한 PPT를 생성하고 있습니다...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      AI가 실무적 내용을 포함한 PPT 생성하기
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // 감마 AI 모드 UI
  return (
    <>
      <Header />
      <div className="flex h-screen bg-gray-900">
        {/* 왼쪽 패널 - 슬라이드 목록 */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          {/* 헤더 */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white text-lg font-semibold">슬라이드</h2>
              <button
                onClick={() => setIsGammaMode(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
            
            {/* 템플릿 선택 */}
            <div className="mb-4">
              <label className="block text-white text-sm font-medium mb-2">템플릿</label>
              <div className="grid grid-cols-2 gap-2">
                {gammaTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplate(template)}
                    className={`p-2 rounded-lg border-2 transition-all ${
                      selectedTemplate.id === template.id
                        ? 'border-blue-400 bg-blue-500 bg-opacity-20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className={`w-full h-8 rounded ${template.preview} mb-1`}></div>
                    <div className="text-white text-xs">{template.name}</div>
                  </button>
                ))}
              </div>
            </div>
            

          </div>
          
          {/* 슬라이드 목록 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {slides.map((slide, index) => (
                <div
                  key={slide.id}
                  draggable
                  onDragStart={() => handleDragStart(slide.id)}
                  onDragOver={(e) => handleDragOver(e, slide.id)}
                  onDrop={(e) => handleDrop(e, slide.id)}
                  className={`p-4 rounded-lg border-2 cursor-move transition-all duration-200 ${
                    currentSlideIndex === index
                      ? 'border-blue-400 bg-blue-500 bg-opacity-20 shadow-lg'
                      : 'border-gray-600 hover:border-gray-500 bg-gray-700 hover:bg-gray-650'
                  } ${
                    draggedSlide === slide.id ? 'opacity-50 scale-95' : ''
                  } ${
                    dragOverSlide === slide.id ? 'border-green-400 bg-green-500 bg-opacity-20' : ''
                  }`}
                  onClick={() => setCurrentSlideIndex(index)}
                >
                  {/* 슬라이드 헤더 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        currentSlideIndex === index ? 'bg-blue-400' : 'bg-gray-500'
                      }`}></div>
                      <span className="text-white text-sm font-semibold">
                        슬라이드 {index + 1}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSlide(slide.id);
                          setEditContent(slide.content.join('\n'));
                        }}
                        className="text-gray-400 hover:text-blue-400 transition-colors p-1 rounded"
                        title="편집"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSlide(slide.id);
                        }}
                        className="text-gray-400 hover:text-red-400 transition-colors p-1 rounded"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  
                  {/* 슬라이드 제목 */}
                  <div className="text-white text-sm font-medium mb-2 line-clamp-2">
                    {slide.title}
                  </div>
                  
                  {/* 슬라이드 정보 */}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <div className="flex items-center space-x-2">
                      <GripVertical className="w-3 h-3" />
                      <span className="capitalize">{slide.layout}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                                            <span className="bg-gray-600 px-2 py-1 rounded">
                        {slide.content.length}개 항목
                      </span>
                      {slide.notes && (
                        <span className="bg-yellow-600 px-2 py-1 rounded">
                          노트
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* 슬라이드 미리보기 (첫 번째 내용만) */}
                  {slide.content.length > 0 && (
                    <div className="mt-2 p-2 bg-gray-600 rounded text-xs text-gray-300 line-clamp-1">
                      {slide.content[0]}
                    </div>
                  )}
                </div>
              ))}
              
              {/* 빈 상태 */}
              {slides.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8" />
                  </div>
                  <p className="text-sm">슬라이드가 없습니다</p>
                  <p className="text-xs mt-1">위의 레이아웃 버튼을 클릭하여 슬라이드를 추가하세요</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 중앙 패널 - 슬라이드 프리뷰 */}
        <div className="flex-1 flex flex-col">
          {/* 툴바 */}
          <div className="bg-gray-800 border-b border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                    showPreview ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {showPreview ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                  프리뷰
                </button>
                

              </div>
              
              <div className="flex items-center space-x-2">
                {/* 다운로드 버튼 */}
                {pptResult && pptResult.slides && pptResult.slides.length > 0 && (
                  <button
                    onClick={downloadPPT}
                    disabled={downloading}
                    className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="PPT 파일 다운로드"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloading ? '생성 중...' : '다운로드'}
                  </button>
                )}
                
                <span className="text-white text-sm">
                  {currentSlideIndex + 1} / {slides.length}
                </span>
                <button
                  onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                  disabled={currentSlideIndex === 0}
                  className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
                  disabled={currentSlideIndex === slides.length - 1}
                  className="p-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
                      {/* 슬라이드 프리뷰 */}
            <div className="flex-1 flex">
              {showPreview && pptResult && pptResult.slides && pptResult.slides.length > 0 && (
                <div className="flex-1 p-8 flex items-center justify-center">
                  <div className="w-full max-w-5xl aspect-video bg-gradient-to-br from-blue-600 to-purple-700 rounded-xl shadow-2xl overflow-hidden relative">
                    {/* 슬라이드 번호 표시 */}
                    <div className="absolute top-4 right-4 z-10 bg-white bg-opacity-20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-semibold">
                      {currentSlideIndex + 1} / {pptResult.slides.length}
                    </div>
                    
                    {/* 슬라이드 컨테이너 */}
                    <div className="w-full h-full relative">
                      <iframe
                        srcDoc={(() => {
                          const html = generateSlideHTML(slides[currentSlideIndex], selectedTemplate);
                          console.log('🔍 웹 프리뷰 HTML:', html.substring(0, 500) + '...');
                          return html;
                        })()}
                        className="w-full h-full border-0"
                        title={`Slide ${currentSlideIndex + 1}`}
                        sandbox="allow-scripts allow-same-origin"
                      />
                    </div>
                    
                    {/* 슬라이드 네비게이션 */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                      {pptResult.slides.map((_: any, index: number) => (
                        <button
                          key={index}
                          onClick={() => setCurrentSlideIndex(index)}
                          className={`w-3 h-3 rounded-full transition-all duration-200 ${
                            index === currentSlideIndex 
                              ? 'bg-white scale-125' 
                              : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            
            {/* 노트 패널 */}
            {showNotes && pptResult && pptResult.slides && pptResult.slides.length > 0 && (
              <div className="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
                <h3 className="text-white text-lg font-semibold mb-4 flex items-center">
                  <i className="fas fa-sticky-note mr-2 text-blue-400"></i>
                  발표 노트
                </h3>
                <div className="space-y-4">
                  {/* 현재 슬라이드 정보 */}
                  <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-blue-400">
                    <h4 className="text-blue-400 text-sm font-medium mb-2 flex items-center">
                      <i className="fas fa-slideshare mr-2"></i>
                      슬라이드 {currentSlideIndex + 1}
                    </h4>
                    <p className="text-white text-sm font-medium">{slides[currentSlideIndex]?.title}</p>
                  </div>
                  
                  {/* 슬라이드 내용 */}
                  <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-green-400">
                    <h4 className="text-green-400 text-sm font-medium mb-2 flex items-center">
                      <i className="fas fa-list-ul mr-2"></i>
                      주요 내용
                    </h4>
                    <ul className="text-white text-sm space-y-2">
                      {slides[currentSlideIndex]?.content.map((item, index) => (
                        <li key={index} className="flex items-start bg-gray-600 rounded p-2">
                          <span className="text-green-400 mr-2 mt-0.5 flex-shrink-0">•</span>
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* 발표 노트 */}
                  {slides[currentSlideIndex]?.notes && (
                    <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-yellow-400">
                      <h4 className="text-yellow-400 text-sm font-medium mb-2 flex items-center">
                        <i className="fas fa-lightbulb mr-2"></i>
                        발표 노트
                      </h4>
                      <p className="text-white text-sm leading-relaxed bg-gray-600 rounded p-2">
                        {slides[currentSlideIndex].notes}
                      </p>
                    </div>
                  )}
                  
                  {/* 레이아웃 정보 */}
                  <div className="bg-gray-700 rounded-lg p-3 border-l-4 border-purple-400">
                    <h4 className="text-purple-400 text-sm font-medium mb-2 flex items-center">
                      <i className="fas fa-palette mr-2"></i>
                      레이아웃 정보
                    </h4>
                    <div className="text-white text-xs space-y-1">
                      <p>• 레이아웃: {slides[currentSlideIndex]?.layout || '기본'}</p>
                      <p>• 템플릿: {slides[currentSlideIndex]?.template || '기본'}</p>
                      <p>• 콘텐츠 수: {slides[currentSlideIndex]?.content?.length || 0}개</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 편집 모달 */}
      {editingSlide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4">
            <h3 className="text-lg font-semibold mb-4">슬라이드 편집</h3>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="슬라이드 내용을 입력하세요..."
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => setEditingSlide(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const updatedSlides = slides.map(slide => 
                    slide.id === editingSlide 
                      ? { ...slide, content: editContent.split('\n').filter(line => line.trim()) }
                      : slide
                  );
                  setSlides(updatedSlides);
                  setEditingSlide(null);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 슬라이드 HTML 생성 함수
function generateSlideHTML(slide: GammaSlide, template: any) {
  const colors = template.colors;
  
  // 레이아웃별 HTML 생성
  const generateLayoutHTML = () => {
    switch (slide.layout) {
      case 'title':
        return generateTitleLayout(slide, colors);
      case 'timeline':
        return generateTimelineLayout(slide, colors);
      case 'comparison':
        return generateComparisonLayout(slide, colors);
      case 'image-heavy':
        return generateImageHeavyLayout(slide, colors);
      case 'grid-cards':
        return generateGridCardsLayout(slide, colors);
      case 'checklist':
        return generateChecklistLayout(slide, colors);
      case 'steps':
        return generateStepsLayout(slide, colors);
      case 'summary-with-image':
        return generateSummaryWithImageLayout(slide, colors);
      case 'chart':
        return generateChartLayout(slide, colors);
      case 'split':
        return generateSplitLayout(slide, colors);
      case 'image':
        return generateImageLayout(slide, colors);
      default:
        return generateDefaultLayout(slide, colors);
    }
  };

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <title>${slide.title}</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
        body {
            width: 100%;
            height: 100vh;
            font-family: 'Montserrat', sans-serif;
            margin: 0;
            padding: 0;
            overflow: hidden;
        }
        .slide-container {
            width: 100%;
            height: 100vh;
            position: relative;
            background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%);
            display: flex;
            flex-direction: column;
        }
        .slide-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 2rem;
            text-align: center;
        }
        .slide-title {
            font-size: 2.5rem;
            font-weight: 700;
            color: white;
            margin-bottom: 2rem;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
            line-height: 1.2;
        }
        .slide-bullets {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            max-width: 80%;
        }
        .slide-bullet {
            font-size: 1.25rem;
            color: white;
            text-align: left;
            padding: 0.5rem 1rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 0.5rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .slide-number {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-weight: 600;
            backdrop-filter: blur(10px);
        }

        .line-clamp-1 {
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 1;
        }
        .line-clamp-2 {
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
        }
        .hover\:bg-gray-650:hover {
            background-color: #374151;
        }
    </style>
</head>
<body>
    <div class="slide-container">
        <!-- 슬라이드 번호 -->
        <div class="slide-number">
            <i class="fas fa-slideshare mr-2"></i>
            슬라이드
        </div>
        
        <!-- 메인 콘텐츠 -->
        <div class="slide-content">
            ${generateLayoutHTML()}
        </div>
        

    </div>
</body>
</html>`;
}

// 기본 레이아웃 (GPT 피드백 적용)
function generateDefaultLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="slide-bullets">
        ${slide.content.map((item, index) => `
        <div class="slide-bullet">
            <i class="fas fa-check-circle text-green-400 mr-3"></i>
            ${item}
        </div>
        `).join('')}
    </div>`;
}

// 타이틀 레이아웃 (GPT 피드백 적용)
function generateTitleLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title" style="font-size: 3.5rem;">
        ${slide.title}
    </h1>
    
    ${slide.content.length > 0 ? `
    <div class="slide-bullets">
        ${slide.content.map((item, index) => `
        <div class="slide-bullet" style="font-size: 1.5rem;">
            ${item}
        </div>
        `).join('')}
    </div>
    ` : ''}`;
}

// 타임라인 레이아웃 (GPT 피드백 적용)
function generateTimelineLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-4xl">
        <div class="grid grid-cols-1 gap-4">
            ${slide.content.map((item, index) => `
            <div class="slide-bullet">
                <div class="flex items-center">
                    <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                        <span class="text-white font-bold text-sm">${index + 1}</span>
                    </div>
                    <span>${item}</span>
                </div>
            </div>
            `).join('')}
        </div>
    </div>`;
}

// 그리드 카드 레이아웃 (GPT 피드백 적용)
function generateGridCardsLayout(slide: GammaSlide, colors: any) {
  const itemsPerRow = Math.ceil(slide.content.length / 2);
  
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-6xl">
        <div class="grid grid-cols-2 gap-6">
            ${slide.content.map((item, index) => `
            <div class="slide-bullet">
                <div class="text-center">
                    <div class="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-star text-white text-xl"></i>
                    </div>
                    <h3 class="text-xl font-semibold mb-2">항목 ${index + 1}</h3>
                    <p>${item}</p>
                </div>
            </div>
            `).join('')}
        </div>
    </div>`;
}

// 체크리스트 레이아웃 (GPT 피드백 적용)
function generateChecklistLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-3xl">
        <div class="space-y-4">
            ${slide.content.map((item, index) => `
            <div class="slide-bullet">
                <div class="flex items-start">
                    <div class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-4 mt-1">
                        <i class="fas fa-check text-white text-xs"></i>
                    </div>
                    <span>${item}</span>
                </div>
            </div>
            `).join('')}
        </div>
    </div>`;
}

// 비교 레이아웃 (GPT 피드백 적용)
function generateComparisonLayout(slide: GammaSlide, colors: any) {
  const midPoint = Math.ceil(slide.content.length / 2);
  const leftItems = slide.content.slice(0, midPoint);
  const rightItems = slide.content.slice(midPoint);
  
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-6xl">
        <div class="grid grid-cols-2 gap-8">
            <div>
                <h3 class="text-2xl font-semibold text-white mb-4 text-center">좌측</h3>
                <div class="space-y-3">
                    ${leftItems.map((item, index) => `
                    <div class="slide-bullet">
                        <i class="fas fa-arrow-right text-blue-400 mr-3"></i>
                        ${item}
                    </div>
                    `).join('')}
                </div>
            </div>
            
            <div>
                <h3 class="text-2xl font-semibold text-white mb-4 text-center">우측</h3>
                <div class="space-y-3">
                    ${rightItems.map((item, index) => `
                    <div class="slide-bullet">
                        <i class="fas fa-arrow-left text-green-400 mr-3"></i>
                        ${item}
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>
    </div>`;
}

// 단계별 레이아웃 (GPT 피드백 적용)
function generateStepsLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-4xl">
        <div class="space-y-6">
            ${slide.content.map((item, index) => `
            <div class="slide-bullet">
                <div class="flex items-center">
                    <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                        <span class="text-white font-bold">${index + 1}</span>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold mb-1">단계 ${index + 1}</h3>
                        <p>${item}</p>
                    </div>
                </div>
            </div>
            `).join('')}
        </div>
    </div>`;
}

// 건강 가이드 레이아웃 (GPT 피드백 적용)
function generateHealthGuideLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-4xl">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            ${slide.content.map((item, index) => `
            <div class="slide-bullet">
                <div class="text-center">
                    <div class="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-heart text-white text-xl"></i>
                    </div>
                    <p>${item}</p>
                </div>
            </div>
            `).join('')}
        </div>
    </div>`;
}

// 요약 이미지 레이아웃 (GPT 피드백 적용)
function generateSummaryWithImageLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-6xl">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="text-2xl font-semibold text-white mb-4">요약</h3>
                <div class="space-y-3">
                    ${slide.content.map((item, index) => `
                    <div class="slide-bullet">
                        <i class="fas fa-check text-green-400 mr-3"></i>
                        ${item}
                    </div>
                    `).join('')}
                </div>
            </div>
            
            <div>
                <div class="bg-white bg-opacity-20 rounded-lg p-6 h-full flex items-center justify-center">
                    <div class="text-center">
                        <i class="fas fa-image text-white text-6xl mb-4"></i>
                        <p class="text-white">이미지 영역</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

// 이미지 중심 레이아웃 (GPT 피드백 적용)
function generateImageHeavyLayout(slide: GammaSlide, colors: any) {
  return `
    <div class="w-full h-full flex flex-col">
        <h1 class="slide-title text-3xl mb-6">
            ${slide.title}
        </h1>
        
        <div class="flex-1 flex items-center justify-center">
            <div class="bg-white bg-opacity-20 rounded-lg p-8 max-w-2xl text-center">
                <i class="fas fa-image text-white text-8xl mb-6"></i>
                <h2 class="text-2xl font-semibold text-white mb-4">주요 이미지</h2>
                <p class="text-white text-lg">시각적 요소가 중심이 되는 슬라이드</p>
            </div>
        </div>
        
        <div class="mt-6">
            <div class="space-y-2">
                ${slide.content.map((item, index) => `
                <div class="slide-bullet text-sm">
                    <i class="fas fa-circle text-white mr-2"></i>
                    ${item}
                </div>
                `).join('')}
            </div>
        </div>
    </div>`;
}

// 차트 레이아웃 (GPT 피드백 적용)
function generateChartLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-6xl">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="text-2xl font-semibold text-white mb-4">데이터 분석</h3>
                <div class="space-y-3">
                    ${slide.content.map((item, index) => `
                    <div class="slide-bullet">
                        <i class="fas fa-chart-bar text-blue-400 mr-3"></i>
                        ${item}
                    </div>
                    `).join('')}
                </div>
            </div>
            
            <div>
                <div class="bg-white bg-opacity-20 rounded-lg p-6 h-full flex items-center justify-center">
                    <div class="text-center">
                        <i class="fas fa-chart-line text-white text-6xl mb-4"></i>
                        <p class="text-white">차트 영역</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

// 분할 레이아웃 (GPT 피드백 적용)
function generateSplitLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-6xl">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h3 class="text-2xl font-semibold text-white mb-4">텍스트</h3>
                <div class="space-y-3">
                    ${slide.content.slice(0, Math.ceil(slide.content.length / 2)).map((item, index) => `
                    <div class="slide-bullet">
                        <i class="fas fa-file-text text-green-400 mr-3"></i>
                        ${item}
                    </div>
                    `).join('')}
                </div>
            </div>
            
            <div>
                <div class="bg-white bg-opacity-20 rounded-lg p-6 h-full flex items-center justify-center">
                    <div class="text-center">
                        <i class="fas fa-image text-white text-6xl mb-4"></i>
                        <p class="text-white">이미지 영역</p>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

// 이미지 레이아웃 (GPT 피드백 적용)
function generateImageLayout(slide: GammaSlide, colors: any) {
  return `
    <h1 class="slide-title">
        ${slide.title}
    </h1>
    
    <div class="w-full max-w-4xl">
        <div class="bg-white bg-opacity-20 rounded-lg p-8 mb-6">
            <div class="text-center">
                <i class="fas fa-image text-white text-8xl mb-4"></i>
                <h2 class="text-2xl font-semibold text-white mb-2">주요 이미지</h2>
                <p class="text-white">시각적 요소 중심</p>
            </div>
        </div>
        
        <div class="space-y-3">
            ${slide.content.map((item, index) => `
            <div class="slide-bullet">
                <i class="fas fa-image text-yellow-400 mr-3"></i>
                ${item}
            </div>
            `).join('')}
        </div>
    </div>`;
} 