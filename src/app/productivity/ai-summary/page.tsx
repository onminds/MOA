"use client";
import { useState } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, LogIn,
  ArrowLeft, Youtube, FileText, Globe, Type, Upload, Play, Download, Copy
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

const inputTypes = [
  { 
    id: 'youtube', 
    name: '유튜브', 
    icon: <Youtube className="w-6 h-6" />, 
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    hoverColor: 'hover:border-red-300',
    selectedColor: 'border-red-500 bg-red-50'
  },
  { 
    id: 'document', 
    name: '문서', 
    icon: <FileText className="w-6 h-6" />, 
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:border-blue-300',
    selectedColor: 'border-blue-500 bg-blue-50'
  },
  { 
    id: 'website', 
    name: '웹사이트', 
    icon: <Globe className="w-6 h-6" />, 
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    hoverColor: 'hover:border-green-300',
    selectedColor: 'border-green-500 bg-green-50'
  },
  { 
    id: 'text', 
    name: '텍스트', 
    icon: <Type className="w-6 h-6" />, 
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    hoverColor: 'hover:border-purple-300',
    selectedColor: 'border-purple-500 bg-purple-50'
  },
];

export default function AISummary() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
  };

  const handleGenerateSummary = async () => {
    setLoading(true);
    setSummary(null);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('type', selectedType!);
      
      switch (selectedType) {
        case 'youtube':
          formData.append('youtubeUrl', youtubeUrl);
          break;
        case 'document':
          if (uploadedFile) {
            formData.append('document', uploadedFile);
          }
          break;
        case 'website':
          formData.append('websiteUrl', websiteUrl);
          break;
        case 'text':
          formData.append('textContent', textContent);
          break;
      }

      const response = await fetch('/api/ai-summary', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '요약 생성에 실패했습니다.');
      }
      
      if (data.summary) {
        setSummary(data.summary);
      } else {
        throw new Error('요약 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('요약 생성 오류:', error);
      setError(error instanceof Error ? error.message : '요약 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySummary = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      // 복사 완료 알림을 추가할 수 있습니다
    }
  };

  const renderInputSection = () => {
    switch (selectedType) {
      case 'youtube':
        return (
          <div className="space-y-4">
            <label className="font-semibold text-gray-700 flex items-center gap-2">
              <Youtube className="w-5 h-5 text-red-500" />
              유튜브 URL
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full p-4 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-white shadow-sm"
                disabled={loading}
              />
              <Youtube className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
            <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded-lg">
              💡 <strong>팁:</strong> 자막이 있는 YouTube 영상을 선택하면 더 정확한 요약을 받을 수 있습니다.
            </div>
          </div>
        );
      
      case 'document':
        return (
          <div className="space-y-4">
            <label className="font-semibold text-gray-700 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              문서 업로드
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-all bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100">
              <Upload className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
                id="file-upload"
                disabled={loading}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-gray-700 mb-2 font-medium">
                  {uploadedFile ? uploadedFile.name : '파일을 선택하거나 여기에 드래그하세요'}
                </div>
                <div className="text-sm text-gray-500">
                  PDF, DOC, DOCX, TXT 파일 지원
                </div>
              </label>
            </div>
          </div>
        );
      
      case 'website':
        return (
          <div className="space-y-4">
            <label className="font-semibold text-gray-700 flex items-center gap-2">
              <Globe className="w-5 h-5 text-green-500" />
              웹사이트 URL
            </label>
            <div className="relative">
              <input
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full p-4 pl-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-white shadow-sm"
                disabled={loading}
              />
              <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            </div>
          </div>
        );
      
      case 'text':
        return (
          <div className="space-y-4">
            <label className="font-semibold text-gray-700 flex items-center gap-2">
              <Type className="w-5 h-5 text-purple-500" />
              요약하고 싶은 내용을 입력해 주세요
            </label>
            <textarea
              placeholder="요약하고 싶은 내용을 입력해 주세요"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full h-64 p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none bg-white shadow-sm transition-all"
              disabled={loading}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  const canGenerate = () => {
    switch (selectedType) {
      case 'youtube':
        return youtubeUrl.trim() !== '';
      case 'document':
        return uploadedFile !== null;
      case 'website':
        return websiteUrl.trim() !== '';
      case 'text':
        return textContent.trim() !== '';
      default:
        return false;
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 flex flex-row w-full">
        {/* 왼쪽 사이드바 */}
        <aside className="w-64 bg-white/80 backdrop-blur-sm min-h-screen p-6 flex-col justify-between hidden md:flex shadow-lg">
          <nav className="space-y-2">
            {sideMenus.map((menu) => (
              <a
                key={menu.name}
                href={menu.href}
                className="flex items-center px-4 py-3 rounded-lg text-gray-800 hover:bg-gray-100 transition-all duration-200 font-medium"
              >
                {menu.icon}
                {menu.name}
              </a>
            ))}
          </nav>
          <div className="mt-8">
            <button className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-all duration-200 font-semibold shadow-lg">
              <LogIn className="w-5 h-5" /> 로그인
            </button>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {/* 헤더 */}
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => router.push('/productivity')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-all duration-200 hover:bg-gray-100 px-3 py-2 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
                뒤로가기
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  AI 완벽요약
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 입력 영역 */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"></div>
                    입력 방식 선택
                  </h2>
                  <div className="grid grid-cols-2 gap-4">
                    {inputTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`p-6 border-2 rounded-xl text-center transition-all duration-200 transform hover:scale-105 ${
                          selectedType === type.id
                            ? `${type.selectedColor} shadow-lg`
                            : `${type.borderColor} ${type.hoverColor} hover:shadow-md`
                        }`}
                        disabled={loading}
                      >
                        <div className={`${type.color} mb-3`}>
                          {type.icon}
                        </div>
                        <div className="font-semibold text-gray-900">{type.name}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedType && (
                  <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                      <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-full"></div>
                      내용 입력
                    </h2>
                    {renderInputSection()}
                    
                    <button
                      onClick={handleGenerateSummary}
                      disabled={!canGenerate() || loading}
                      className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2 mt-6"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          요약 생성 중...
                        </>
                      ) : (
                        <>
                          요약 생성
                        </>
                      )}
                    </button>
                    
                    {error && (
                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="text-red-800 font-medium">오류 발생</div>
                        <div className="text-red-600 text-sm mt-1">{error}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 결과 영역 */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"></div>
                  요약 결과
                </h2>
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 min-h-[500px]">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                        <div className="text-gray-600 font-medium">요약을 생성하고 있습니다...</div>
                        <div className="text-sm text-gray-500 mt-2">AI가 내용을 분석하고 있어요</div>
                      </div>
                    </div>
                  ) : summary ? (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 border border-gray-200">
                        <div className="whitespace-pre-wrap text-gray-800 leading-relaxed font-medium">
                          {summary}
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg transform hover:scale-105">
                          <Download className="w-4 h-4" />
                          다운로드
                        </button>
                        <button 
                          onClick={handleCopySummary}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                        >
                          <Copy className="w-4 h-4" />
                          복사
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-500">
                        {/* Sparkles icon removed */}
                        <div className="font-medium">요약 결과가 여기에 표시됩니다</div>
                        <div className="text-sm mt-2">입력 방식을 선택하고 내용을 입력해주세요</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 