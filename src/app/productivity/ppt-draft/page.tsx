"use client";
import { useState } from "react";
import Image from 'next/image';
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  ArrowLeft, Presentation, Copy, Loader2, CheckCircle, AlertCircle, FileText, Download,
  Lightbulb, Target, Brain, Eye, Upload, Image as ImageIcon, Edit3, 
  Plus, Minus, BookOpen, Camera
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const sideMenus = [
  { name: '홈', icon: <HomeIcon className="w-5 h-5 mr-2" />, href: '/' },
  { name: '검색', icon: <Search className="w-5 h-5 mr-2" />, href: '#' },
  { name: 'AI 목록', icon: <List className="w-5 h-5 mr-2" />, href: '#' },
  { name: '순위', icon: <BarChart className="w-5 h-5 mr-2" />, href: '#' },
  { name: '광고', icon: <Megaphone className="w-5 h-5 mr-2" />, href: '#' },
  { name: 'AI 뉴스', icon: <Newspaper className="w-5 h-5 mr-2" />, href: '#' },
  { name: '문의하기', icon: <MessageCircle className="w-5 h-5 mr-2" />, href: '#' },
  { name: '설정', icon: <Settings className="w-5 h-5 mr-2" />, href: '#' },
];

const presentationTypes = [
  { value: 'business', label: '비즈니스 프레젠테이션', description: '회사 보고, 제안서, 사업계획서' },
  { value: 'academic', label: '학술 발표', description: '논문 발표, 연구 결과, 학회 발표' },
  { value: 'educational', label: '교육용 자료', description: '강의, 세미나, 교육 프로그램' },
  { value: 'sales', label: '영업/마케팅', description: '제품 소개, 영업 제안, 마케팅 전략' },
  { value: 'project', label: '프로젝트 발표', description: '프로젝트 계획, 진행 상황, 결과 보고' }
];

interface PPTSlide {
  id: number;
  title: string;
  content: string[];
  notes?: string;
  images?: string[];
  chapterId?: number;
  backgroundColor?: string;
  textColor?: string;
  layout?: 'title' | 'content' | 'image' | 'split' | 'chart';
}

interface Chapter {
  id: number;
  title: string;
  description: string;
  slideCount: number;
  color: string;
}

interface PPTDraftResult {
  title: string;
  subtitle: string;
  outline: string[];
  slides: PPTSlide[];
  chapters: Chapter[];
  designSuggestions: string[];
  presentationTips: string[];
  estimatedDuration: string;
}

export default function PPTDraft() {
  const router = useRouter();
  
  // 입력 상태
  const [topic, setTopic] = useState('');
  const [presentationType, setPresentationType] = useState('business');
  const [targetAudience, setTargetAudience] = useState('');
  const [duration, setDuration] = useState('10');
  const [keyPoints, setKeyPoints] = useState('');
  const [objectives, setObjectives] = useState('');
  
  // 결과 상태
  const [pptResult, setPptResult] = useState<PPTDraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pptGenerating, setPptGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // 편집 상태
  const [editMode, setEditMode] = useState(false);
  const [currentSlideId, setCurrentSlideId] = useState<number | null>(null);
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  
  // 챕터 관리
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [newChapter, setNewChapter] = useState({ title: '', description: '', color: '#3B82F6' });
  
  // 파일 업로드
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  // 히스토리
  const [draftHistory, setDraftHistory] = useState<Array<{
    id: number;
    topic: string;
    type: string;
    slideCount: number;
    timestamp: Date;
  }>>([]);

  // PPT 초안 생성
  const generatePPTDraft = async () => {
    if (!topic.trim()) {
      setError('발표 주제를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setPptResult(null);

    try {
      const response = await fetch('/api/ppt-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: topic.trim(),
          presentationType,
          targetAudience: targetAudience.trim(),
          duration: parseInt(duration),
          keyPoints: keyPoints.trim(),
          objectives: objectives.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PPT 초안 생성에 실패했습니다.');
      }

      const data = await response.json();
      
      if (data.success && data.result) {
        setPptResult(data.result);
        
        // 챕터 정보가 있으면 챕터 상태도 업데이트
        if (data.result.chapters) {
          setChapters(data.result.chapters);
        }
        
        // 히스토리에 추가
        const newHistoryItem = {
          id: Date.now(),
          topic: topic.trim(),
          type: presentationType,
          slideCount: data.result.slides.length,
          timestamp: new Date()
        };
        setDraftHistory(prev => [newHistoryItem, ...prev.slice(0, 9)]); // 최대 10개 유지
      } else {
        throw new Error('PPT 초안 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('PPT 초안 생성 오류:', error);
      setError(error instanceof Error ? error.message : 'PPT 초안 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 텍스트 복사
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: 토스트 알림 추가
  };

  // 외부 API로 실제 PPT 파일 생성
  const generatePPTFile = async () => {
    if (!pptResult) return;

    setPptGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // 외부 PPT 생성 API 호출
      const response = await fetch('/api/ppt-file-generator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: pptResult.title,
          subtitle: pptResult.subtitle,
          slides: pptResult.slides,
          chapters: chapters,
          designOptions: {
            theme: 'professional',
            language: 'korean',
            colorScheme: 'modern'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PPT 파일 생성에 실패했습니다.');
      }

      const data = await response.json();
      
      if (data.success && data.downloadUrl) {
        // PPT 파일 다운로드
        const downloadLink = document.createElement('a');
        downloadLink.href = data.downloadUrl;
        downloadLink.download = data.fileName || `${pptResult.title}_AI프레젠테이션.pptx`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        setSuccessMessage(`🎨 "${pptResult.title}" 프로급 PPT 파일이 성공적으로 생성되어 다운로드되었습니다! 
        최신 AI 기술로 제작된 고품질 프레젠테이션입니다. 📊`);
        
        // 5초 후 성공 메시지 자동 삭제
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        throw new Error('PPT 파일 생성 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('PPT 파일 생성 오류:', error);
      setError(`PPT 파일 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setPptGenerating(false);
    }
  };


  // 파일 업로드 처리
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // PPT 파일 분석 API 호출
      // TODO: PPT 파일 분석 구현
    }
  };

  // 이미지 업로드 처리
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const imageUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        imageUrls.push(url);
      }
      setUploadedImages(prev => [...prev, ...imageUrls]);
    }
  };

  // 챕터 추가
  const addChapter = () => {
    if (newChapter.title.trim()) {
      const chapter: Chapter = {
        id: Date.now(),
        title: newChapter.title,
        description: newChapter.description,
        slideCount: 0,
        color: newChapter.color
      };
      setChapters(prev => [...prev, chapter]);
      setNewChapter({ title: '', description: '', color: '#3B82F6' });
      setShowChapterModal(false);
    }
  };

  // 챕터 삭제
  const deleteChapter = (chapterId: number) => {
    setChapters(prev => prev.filter(ch => ch.id !== chapterId));
    // 해당 챕터의 슬라이드들도 업데이트
    if (pptResult) {
      const updatedSlides = pptResult.slides.map(slide => 
        slide.chapterId === chapterId ? { ...slide, chapterId: undefined } : slide
      );
      setPptResult({ ...pptResult, slides: updatedSlides });
    }
  };

  // 슬라이드 편집
  const updateSlide = (slideId: number, updates: Partial<PPTSlide>) => {
    if (pptResult) {
      const updatedSlides = pptResult.slides.map(slide => 
        slide.id === slideId ? { ...slide, ...updates } : slide
      );
      setPptResult({ ...pptResult, slides: updatedSlides });
    }
  };

  // 슬라이드에 이미지 추가
  const addImageToSlide = (slideId: number, imageUrl: string) => {
    updateSlide(slideId, { 
      images: [...(pptResult?.slides.find(s => s.id === slideId)?.images || []), imageUrl] 
    });
  };

  // 슬라이드 삭제
  const deleteSlide = (slideId: number) => {
    if (pptResult) {
      const updatedSlides = pptResult.slides.filter(slide => slide.id !== slideId);
      setPptResult({ ...pptResult, slides: updatedSlides });
    }
  };

  // 새 슬라이드 추가
  const addNewSlide = () => {
    if (pptResult) {
      const newSlide: PPTSlide = {
        id: Date.now(),
        title: '새 슬라이드',
        content: ['새로운 내용을 추가하세요'],
        layout: 'content'
      };
      const updatedSlides = [...pptResult.slides, newSlide];
      setPptResult({ ...pptResult, slides: updatedSlides });
    }
  };

  // PPT 전체 내용 다운로드용 텍스트 생성
  const generateDownloadText = () => {
    if (!pptResult) return '';
    
    let content = `${pptResult.title}\n${pptResult.subtitle}\n\n`;
    content += `목차:\n${pptResult.outline.map((item, idx) => `${idx + 1}. ${item}`).join('\n')}\n\n`;
    
    pptResult.slides.forEach((slide, idx) => {
      content += `슬라이드 ${idx + 1}: ${slide.title}\n`;
      slide.content.forEach(point => {
        content += `• ${point}\n`;
      });
      if (slide.notes) {
        content += `노트: ${slide.notes}\n`;
      }
      content += '\n';
    });
    
    return content;
  };

  return (
    <>
      <Header />
      <div className="flex min-h-screen bg-gray-50">
        {/* 사이드바 */}
        <div className="w-64 bg-white shadow-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">메뉴</h2>
            <nav>
              {sideMenus.map((menu, index) => (
                <a
                  key={index}
                  href={menu.href}
                  className="flex items-center py-2 px-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors mb-1"
                >
                  {menu.icon}
                  {menu.name}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {/* 헤더 */}
            <div className="mb-8">
              <button
                onClick={() => router.push('/productivity')}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mb-4"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                생산성 도구로 돌아가기
              </button>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-blue-500 p-2 rounded-xl">
                  <Presentation className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">AI PPT 초안</h1>
                  <p className="text-gray-700 mt-1">AI가 프레젠테이션 구조와 내용을 자동으로 작성해드립니다</p>
                </div>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            {/* 성공 메시지 */}
            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-green-700">{successMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 입력 패널 */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Lightbulb className="w-6 h-6 text-blue-500" />
                    📝 어떤 발표를 준비하시나요?
                  </h2>

                  {/* 파일 업로드 옵션 */}
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <h3 className="font-medium text-amber-900 mb-3 flex items-center gap-2">
                      <Upload className="w-5 h-5" />
                      📁 기존 PPT 파일이 있으신가요?
                    </h3>
                    <div className="flex items-center gap-4">
                      <label className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors cursor-pointer flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        PPT 파일 업로드
                        <input
                          type="file"
                          accept=".ppt,.pptx"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                      {uploadedFile && (
                        <span className="text-sm text-amber-700">
                          ✅ {uploadedFile.name} 업로드됨
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-amber-700 mt-2">
                      💡 기존 PPT를 업로드하면 AI가 분석해서 개선점을 제안해드려요!
                    </p>
                  </div>

                  {/* 발표 주제 */}
                  <div className="mb-6">
                    <label className="block text-lg font-medium text-gray-800 mb-3">
                      🎯 발표 주제 *
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="예: '인공지능 기술의 미래와 우리 회사의 대응 전략'"
                      className="w-full p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-black"
                    />
                    <p className="text-sm text-gray-600 mt-2">
                      💡 구체적이고 명확한 주제일수록 더 좋은 결과를 얻을 수 있어요!
                    </p>
                  </div>

                  {/* 기본 설정 */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-800 mb-4">⚙️ 기본 설정</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 발표 유형 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          📊 발표 유형
                        </label>
                        <select
                          value={presentationType}
                          onChange={(e) => setPresentationType(e.target.value)}
                          className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        >
                          {presentationTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 발표 시간 */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ⏰ 발표 시간 (분)
                        </label>
                        <select
                          value={duration}
                          onChange={(e) => setDuration(e.target.value)}
                          className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                        >
                          <option value="5">5분 (간단한 브리핑)</option>
                          <option value="10">10분 (표준 발표)</option>
                          <option value="15">15분 (상세한 설명)</option>
                          <option value="20">20분 (종합적 발표)</option>
                          <option value="30">30분 (완전한 프레젠테이션)</option>
                          <option value="45">45분 (심화 발표)</option>
                          <option value="60">60분 (장시간 발표)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 선택된 발표 유형 설명 */}
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-blue-800 text-sm">
                      <strong>{presentationTypes.find(t => t.value === presentationType)?.label}:</strong>{' '}
                      {presentationTypes.find(t => t.value === presentationType)?.description}
                    </p>
                  </div>

                  {/* 대상 청중 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      👥 대상 청중 (선택사항)
                    </label>
                    <input
                      type="text"
                      value={targetAudience}
                      onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder="예: '임원진', '동료 개발자들', '고객사 담당자들'"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-black"
                    />
                  </div>

                  {/* 핵심 내용 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📋 꼭 포함할 핵심 내용 (선택사항)
                    </label>
                    <textarea
                      value={keyPoints}
                      onChange={(e) => setKeyPoints(e.target.value)}
                      placeholder="꼭 언급하고 싶은 내용들을 줄바꿈으로 구분해서 적어주세요..."
                      rows={4}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-black"
                    />
                  </div>

                  {/* 발표 목적 */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      🎯 발표 목적/목표 (선택사항)
                    </label>
                    <textarea
                      value={objectives}
                      onChange={(e) => setObjectives(e.target.value)}
                      placeholder="이 발표를 통해 달성하고 싶은 목표를 적어주세요..."
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-500 text-black"
                    />
                  </div>

                  {/* 챕터/섹션 등록 */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        📚 챕터/섹션 구성 (선택사항)
                      </label>
                      <button
                        onClick={() => setShowChapterModal(true)}
                        className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-3 h-3" />
                        챕터 추가
                      </button>
                    </div>
                    
                    {chapters.length > 0 ? (
                      <div className="space-y-2">
                        {chapters.map((chapter, idx) => (
                          <div key={chapter.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: chapter.color }}
                            ></div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{idx + 1}. {chapter.title}</div>
                              <div className="text-sm text-gray-600">{chapter.description}</div>
                            </div>
                            <button
                              onClick={() => deleteChapter(chapter.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <BookOpen className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                          챕터를 추가하면 발표를 체계적으로 구성할 수 있어요!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 생성 버튼 */}
                  <div className="text-center">
                    <button
                      onClick={generatePPTDraft}
                      disabled={loading || !topic.trim()}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-5 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-bold text-xl disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-7 h-7 animate-spin" />
                          🎨 AI가 발표 자료를 만들고 있어요...
                        </>
                      ) : (
                        <>
                          <Brain className="w-7 h-7" />
                          🚀 AI에게 PPT 초안 맡기기!
                        </>
                      )}
                    </button>
                    <p className="text-sm text-gray-600 mt-3">
                      {!topic.trim() ? '👆 발표 주제를 먼저 입력해주세요!' : '📋 PPT 초안 생성을 시작할 준비가 되었어요!'}
                    </p>
                  </div>
                </div>

                {/* PPT 초안 결과 */}
                {pptResult && (
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        🎨 PPT 초안이 완성되었어요!
                      </h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditMode(!editMode)}
                          className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                            editMode 
                              ? 'bg-orange-500 text-white hover:bg-orange-600' 
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          <Edit3 className="w-4 h-4" />
                          {editMode ? '편집 완료' : '편집 모드'}
                        </button>
                        <button
                          onClick={() => setShowImageUpload(true)}
                          className="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-600 transition-colors flex items-center gap-2"
                        >
                          <ImageIcon className="w-4 h-4" />
                          이미지
                        </button>
                        <button
                          onClick={() => copyText(generateDownloadText())}
                          className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
                        >
                          <Copy className="w-4 h-4" />
                          전체 복사
                        </button>
                        <button
                          onClick={() => {
                            const element = document.createElement("a");
                            const file = new Blob([generateDownloadText()], {type: 'text/plain'});
                            element.href = URL.createObjectURL(file);
                            element.download = `${pptResult.title}_초안.txt`;
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                          }}
                          className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-600 transition-colors flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          텍스트
                        </button>
                        <button
                          onClick={generatePPTFile}
                          disabled={pptGenerating}
                          className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 font-bold shadow-lg ${
                            pptGenerating 
                              ? 'bg-gray-400 cursor-not-allowed' 
                              : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
                          }`}
                        >
                          {pptGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              🎨 고품질 PPT 제작 중...
                            </>
                          ) : (
                            <>
                              <Presentation className="w-4 h-4" />
                              🎨 프로급 PPT 생성하기
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 편집 모드 툴바 */}
                    {editMode && (
                      <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center gap-4 mb-3">
                          <h4 className="font-medium text-orange-900">✏️ 편집 도구</h4>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={addNewSlide}
                            className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
                          >
                            <Plus className="w-3 h-3" />
                            슬라이드 추가
                          </button>
                          <label className="bg-purple-500 text-white px-3 py-1 rounded text-sm hover:bg-purple-600 transition-colors cursor-pointer flex items-center gap-2">
                            <Camera className="w-3 h-3" />
                            이미지 업로드
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleImageUpload}
                              className="hidden"
                            />
                          </label>
                          <div className="text-sm text-orange-700">
                            💡 슬라이드를 클릭하면 직접 편집할 수 있어요!
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 제목과 부제목 */}
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="text-xl font-bold text-blue-900 mb-2">{pptResult.title}</h4>
                      <p className="text-blue-700">{pptResult.subtitle}</p>
                    </div>

                    {/* 발표 정보 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-lg font-bold text-gray-900">{pptResult.slides.length}개</div>
                        <div className="text-sm text-gray-600">슬라이드</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-lg font-bold text-gray-900">{pptResult.estimatedDuration}</div>
                        <div className="text-sm text-gray-600">예상 시간</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-lg font-bold text-gray-900">{presentationTypes.find(t => t.value === presentationType)?.label}</div>
                        <div className="text-sm text-gray-600">발표 유형</div>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <div className="text-lg font-bold text-gray-900">{targetAudience || '일반'}</div>
                        <div className="text-sm text-gray-600">대상 청중</div>
                      </div>
                    </div>

                    {/* 목차 */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <List className="w-5 h-5" />
                        📋 목차
                      </h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <ol className="list-decimal list-inside space-y-2">
                          {pptResult.outline.map((item, idx) => (
                            <li key={idx} className="text-gray-800">{item}</li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    {/* 챕터 구성 */}
                    {pptResult.chapters && pptResult.chapters.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <BookOpen className="w-5 h-5" />
                          📚 챕터 구성
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {pptResult.chapters.map((chapter, idx) => (
                            <div 
                              key={chapter.id} 
                              className="p-4 bg-white border rounded-lg shadow-sm"
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <div 
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: chapter.color }}
                                ></div>
                                <h5 className="font-medium text-gray-900">
                                  {idx + 1}. {chapter.title}
                                </h5>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{chapter.description}</p>
                              <div className="text-xs text-gray-500">
                                {chapter.slideCount}개 슬라이드
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 슬라이드 내용 */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Presentation className="w-5 h-5" />
                        🎞️ 슬라이드 내용
                      </h4>
                      <div className="space-y-4">
                        {pptResult.slides.map((slide, idx) => (
                          <div 
                            key={slide.id} 
                            className={`border border-gray-200 rounded-lg p-4 transition-all ${
                              editMode ? 'hover:shadow-md hover:border-blue-300 cursor-pointer' : ''
                            } ${currentSlideId === slide.id ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
                            onClick={() => editMode && setCurrentSlideId(currentSlideId === slide.id ? null : slide.id)}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {editMode ? (
                                  <input
                                    type="text"
                                    value={slide.title}
                                    onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
                                    className="font-semibold text-gray-900 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <h5 className="font-semibold text-gray-900">
                                    슬라이드 {idx + 1}: {slide.title}
                                  </h5>
                                )}
                                {slide.chapterId && chapters.find(ch => ch.id === slide.chapterId) && (
                                  <span 
                                    className="px-2 py-1 rounded-full text-xs text-white"
                                    style={{ backgroundColor: chapters.find(ch => ch.id === slide.chapterId)?.color }}
                                  >
                                    {chapters.find(ch => ch.id === slide.chapterId)?.title}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {editMode && (
                                  <>
                                    <select
                                      value={slide.chapterId || ''}
                                      onChange={(e) => updateSlide(slide.id, { 
                                        chapterId: e.target.value ? parseInt(e.target.value) : undefined 
                                      })}
                                      className="text-xs border border-gray-300 rounded px-2 py-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <option value="">챕터 없음</option>
                                      {chapters.map(chapter => (
                                        <option key={chapter.id} value={chapter.id}>
                                          {chapter.title}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteSlide(slide.id);
                                      }}
                                      className="text-red-500 hover:text-red-700 transition-colors"
                                    >
                                      <Minus className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyText(`${slide.title}\n\n${slide.content.join('\n• ')}`);
                                  }}
                                  className="text-gray-500 hover:text-blue-500 transition-colors"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* 슬라이드 내용 */}
                            <div className="mb-3">
                              {editMode ? (
                                <div className="space-y-2">
                                  {slide.content.map((point, pointIdx) => (
                                    <div key={pointIdx} className="flex items-center gap-2">
                                      <span className="text-gray-400">•</span>
                                      <input
                                        type="text"
                                        value={point}
                                        onChange={(e) => {
                                          const newContent = [...slide.content];
                                          newContent[pointIdx] = e.target.value;
                                          updateSlide(slide.id, { content: newContent });
                                        }}
                                        className="flex-1 text-sm border-b border-gray-200 focus:border-blue-500 outline-none bg-transparent"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newContent = slide.content.filter((_, i) => i !== pointIdx);
                                          updateSlide(slide.id, { content: newContent });
                                        }}
                                        className="text-red-400 hover:text-red-600 transition-colors"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateSlide(slide.id, { 
                                        content: [...slide.content, '새로운 포인트'] 
                                      });
                                    }}
                                    className="text-blue-500 hover:text-blue-700 transition-colors flex items-center gap-1 text-sm"
                                  >
                                    <Plus className="w-3 h-3" />
                                    포인트 추가
                                  </button>
                                </div>
                              ) : (
                                <ul className="list-disc list-inside space-y-1">
                                  {slide.content.map((point, pointIdx) => (
                                    <li key={pointIdx} className="text-gray-700 text-sm">{point}</li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {/* 이미지 섹션 */}
                            {slide.images && slide.images.length > 0 && (
                              <div className="mb-3">
                                <h6 className="text-xs font-medium text-gray-600 mb-2">🖼️ 포함된 이미지</h6>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {slide.images.map((imageUrl, imgIdx) => (
                                    <div key={imgIdx} className="relative group">
                                      <Image
                                        src={imageUrl}
                                        alt={`슬라이드 ${idx + 1} 이미지 ${imgIdx + 1}`}
                                        width={100}
                                        height={50}
                                        className="w-full h-20 object-cover rounded border"
                                      />
                                      {editMode && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const newImages = slide.images?.filter((_, i) => i !== imgIdx) || [];
                                            updateSlide(slide.id, { images: newImages });
                                          }}
                                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 이미지 추가 버튼 */}
                            {editMode && uploadedImages.length > 0 && (
                              <div className="mb-3">
                                <h6 className="text-xs font-medium text-gray-600 mb-2">📷 업로드된 이미지 추가</h6>
                                <div className="grid grid-cols-4 gap-2">
                                  {uploadedImages.map((imageUrl, imgIdx) => (
                                    <button
                                      key={imgIdx}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addImageToSlide(slide.id, imageUrl);
                                      }}
                                      className="relative group"
                                    >
                                      <Image
                                        src={imageUrl}
                                        alt={`업로드된 이미지 ${imgIdx + 1}`}
                                        width={100}
                                        height={50}
                                        className="w-full h-16 object-cover rounded border hover:border-blue-500 transition-colors"
                                      />
                                      <div className="absolute inset-0 bg-blue-500 bg-opacity-0 hover:bg-opacity-20 rounded transition-all flex items-center justify-center">
                                        <Plus className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 발표 노트 */}
                            {(slide.notes || editMode) && (
                              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3">
                                {editMode ? (
                                  <div>
                                    <label className="text-yellow-800 text-sm font-medium block mb-1">📝 발표 노트:</label>
                                    <textarea
                                      value={slide.notes || ''}
                                      onChange={(e) => updateSlide(slide.id, { notes: e.target.value })}
                                      placeholder="발표할 때 참고할 노트를 작성하세요..."
                                      rows={2}
                                      className="w-full text-yellow-800 text-sm bg-transparent border border-yellow-300 rounded p-2 focus:border-yellow-500 outline-none"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                ) : slide.notes && (
                                  <p className="text-yellow-800 text-sm">
                                    <strong>📝 발표 노트:</strong> {slide.notes}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 디자인 제안과 발표 팁 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          🎨 디자인 제안
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {pptResult.designSuggestions.map((suggestion, idx) => (
                            <li key={idx} className="text-purple-800 text-sm">{suggestion}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-green-50 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          💡 발표 팁
                        </h4>
                        <ul className="list-disc list-inside space-y-1">
                          {pptResult.presentationTips.map((tip, idx) => (
                            <li key={idx} className="text-green-800 text-sm">{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 히스토리 패널 */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
                  <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    📚 작성한 PPT들
                  </h3>

                  {draftHistory.length === 0 ? (
                    <div className="text-center py-6">
                      <Presentation className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">
                        아직 만든 PPT가 없어요!<br />
                        🎨 첫 번째 PPT 초안을 만들어보세요!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {draftHistory.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                              {presentationTypes.find(t => t.value === item.type)?.label}
                            </span>
                            <span className="text-sm font-bold text-blue-600">
                              {item.slideCount}장
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 mb-2 font-medium">
                            {item.topic}
                          </p>
                          <p className="text-xs text-gray-600">
                            {item.timestamp.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 챕터 추가 모달 */}
      {showChapterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-500" />
              새 챕터 추가
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  챕터 제목 *
                </label>
                                  <input
                    type="text"
                    value={newChapter.title}
                    onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })}
                    placeholder="🏷️ 예: 도입부, 핵심내용, 마무리"
                    className="w-full p-3 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 text-black placeholder:text-gray-700 font-medium"
                  />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  챕터 설명
                </label>
                                  <textarea
                    value={newChapter.description}
                    onChange={(e) => setNewChapter({ ...newChapter, description: e.target.value })}
                    placeholder="이 챕터에서 다룰 내용을 간단히 설명해주세요"
                    rows={2}
                    className="w-full p-3 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 text-black placeholder:text-gray-600"
                  />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  챕터 색상
                </label>
                                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newChapter.color}
                      onChange={(e) => setNewChapter({ ...newChapter, color: e.target.value })}
                      className="w-14 h-12 border-2 border-gray-400 rounded-lg cursor-pointer"
                    />
                    <span className="text-sm text-gray-800 font-medium">
                      슬라이드에서 이 색상으로 표시됩니다
                    </span>
                  </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowChapterModal(false);
                  setNewChapter({ title: '', description: '', color: '#3B82F6' });
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={addChapter}
                disabled={!newChapter.title.trim()}
                className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                챕터 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 업로드 모달 */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-500" />
              이미지 관리
            </h3>
            
            <div className="space-y-4">
              {/* 이미지 업로드 */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <label className="cursor-pointer">
                  <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-2">클릭하여 이미지를 업로드하세요</p>
                  <p className="text-sm text-gray-500">JPG, PNG, GIF (최대 10MB)</p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
              
              {/* 업로드된 이미지 목록 */}
              {uploadedImages.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">
                    업로드된 이미지 ({uploadedImages.length}개)
                  </h4>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto">
                    {uploadedImages.map((imageUrl, idx) => (
                      <div key={idx} className="relative group">
                        <Image
                          src={imageUrl}
                          alt={`업로드된 이미지 ${idx + 1}`}
                          width={100}
                          height={50}
                          className="w-full h-20 object-cover rounded border"
                        />
                        <button
                          onClick={() => {
                            const newImages = uploadedImages.filter((_, i) => i !== idx);
                            setUploadedImages(newImages);
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowImageUpload(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                닫기
              </button>
              <button
                onClick={() => setShowImageUpload(false)}
                className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 