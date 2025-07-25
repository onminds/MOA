"use client";
import { useState } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, LogIn,
  ArrowLeft, FileText, Search as SearchIcon, Download, Copy, Loader2, X, Plus, HelpCircle, Paperclip
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

export default function CoverLetter() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [keyExperience, setKeyExperience] = useState('');
  const [useSearchResults, setUseSearchResults] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [coverLetterContent, setCoverLetterContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 파일 크기 체크 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('파일 크기는 10MB 이하여야 합니다.');
        return;
      }
      
      // 파일 형식 체크
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('PDF 또는 DOCX 파일만 업로드 가능합니다.');
        return;
      }
      
      setUploadedFile(file);
      setError(null);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  const handleGenerateCoverLetter = async () => {
    if (!companyName.trim()) {
      setError('회사명/학교명을 입력해주세요.');
      return;
    }

    if (!jobTitle.trim()) {
      setError('지원 직무/지원 학과를 입력해주세요.');
      return;
    }

    if (!keyExperience.trim()) {
      setError('주요 경험과 역량을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('companyName', companyName.trim());
      formData.append('jobTitle', jobTitle.trim());
      formData.append('keyExperience', keyExperience.trim());
      formData.append('useSearchResults', useSearchResults.toString());
      
      if (uploadedFile) {
        formData.append('file', uploadedFile);
      }

      const response = await fetch('/api/cover-letter', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '자기소개서 생성에 실패했습니다.');
      }
      
      if (data.coverLetterContent) {
        setCoverLetterContent(data.coverLetterContent);
      } else {
        throw new Error('자기소개서 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('자기소개서 생성 오류:', error);
      setError(error instanceof Error ? error.message : '자기소개서 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCoverLetter = () => {
    if (coverLetterContent) {
      navigator.clipboard.writeText(coverLetterContent);
    }
  };

  const handleDownloadCoverLetter = () => {
    if (coverLetterContent) {
      const blob = new Blob([coverLetterContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${companyName.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_자기소개서.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const resetForm = () => {
    setCompanyName('');
    setJobTitle('');
    setKeyExperience('');
    setUseSearchResults(true);
    setUploadedFile(null);
    setCoverLetterContent(null);
    setError(null);
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
          <div className="max-w-8xl mx-auto">
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
                  AI 자기소개서 작성
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* 입력 영역 */}
              <div className="space-y-6 xl:col-span-1">
                {/* 회사명/학교명 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">회사명 / 학교명</h2>
                    <span className="text-sm text-red-500 font-medium">*</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">지원하는 회사나 학교의 정확한 명칭을 입력해주세요</p>
                  
                  <input
                    type="text"
                    placeholder="회사명"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    maxLength={50}
                    className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                    disabled={loading}
                  />
                </div>

                {/* 지원 직무/지원 학과 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">지원 직무 / 지원 학과</h2>
                    <span className="text-sm text-red-500 font-medium">*</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">지원하는 직무나 학과를 정확히 입력해주세요</p>
                  
                  <input
                    type="text"
                    placeholder="직무명 / 학과명"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    maxLength={50}
                    className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                    disabled={loading}
                  />
                </div>

                {/* 강조할 경험과 핵심 이력 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">강조할 경험과 핵심 이력</h2>
                    <span className="text-sm text-red-500 font-medium">*</span>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        <div className="text-center">
                          <div className="font-semibold mb-1">강조할 경험이란?</div>
                          <div className="text-gray-200 leading-relaxed">
                            자기소개서에 반영하고 싶은 주요 경험,<br/>
                            성과, 스킬, 프로젝트 등을 입력해주세요.<br/>
                            예: &quot;웹 개발 프로젝트 3개 완료&quot;, &quot;팀 리더 경험&quot;,<br/>
                            &quot;관련 자격증 보유&quot; 등
                          </div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">자기소개서에 반영되어야 할 핵심 내용을 입력해 주세요</p>
                  
                  <div className="relative">
                    <textarea
                      placeholder="자기소개서에 반영되어야 할 핵심 내용을 입력해 주세요"
                      value={keyExperience}
                      onChange={(e) => setKeyExperience(e.target.value)}
                      maxLength={500}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 resize-none"
                      rows={4}
                      disabled={loading}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {keyExperience.length}/500
                    </div>
                  </div>
                </div>

                {/* 인터넷 검색 결과 활용 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">인터넷 검색 결과 활용하기</h2>
                      <p className="text-sm text-gray-600">지원 회사/학교와 관련된 정보를 자동으로 검색하여 반영해요</p>
                    </div>
                    <button
                      onClick={() => setUseSearchResults(!useSearchResults)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useSearchResults ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          useSearchResults ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                      <SearchIcon className="absolute right-1 w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>

                {/* 파일 첨부 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">파일 첨부 (선택)</h2>
                  <p className="text-sm text-gray-600 mb-4">이력서, 생활기록부, 자기소개서, 공고 내용 등 참고할 만한 자료가 있으면 업로드해 주세요.</p>
                  <p className="text-xs text-gray-500 mb-4">.pdf, .docx 파일 1개(10mb) 업로드 가능</p>
                  
                  <div className="flex gap-3">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept=".pdf,.docx"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={loading}
                      />
                      <div className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-100 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-200 transition-all">
                        <Paperclip className="w-4 h-4 text-gray-600" />
                        <span className="text-gray-700">파일을 업로드해 주세요</span>
                      </div>
                    </label>
                    <button
                      onClick={() => {
                        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                        if (fileInput) fileInput.click();
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                      disabled={loading}
                    >
                      <Plus className="w-4 h-4 text-blue-600" />
                      <span className="text-gray-700">파일 추가</span>
                    </button>
                  </div>
                  
                  {uploadedFile && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-blue-800">{uploadedFile.name}</span>
                          <span className="text-xs text-blue-600">
                            ({(uploadedFile.size / 1024 / 1024).toFixed(2)}MB)
                          </span>
                        </div>
                        <button
                          onClick={removeFile}
                          className="text-red-500 hover:text-red-700"
                          disabled={loading}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 자기소개서 생성 버튼 */}
                <button
                  onClick={handleGenerateCoverLetter}
                  disabled={!companyName.trim() || !jobTitle.trim() || !keyExperience.trim() || loading}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      자기소개서 생성 중...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      자기소개서 생성
                    </>
                  )}
                </button>
                
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-red-800 font-medium">오류 발생</div>
                    <div className="text-red-600 text-sm mt-1">{error}</div>
                  </div>
                )}
              </div>

              {/* 결과 영역 */}
              <div className="space-y-4 xl:col-span-2">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"></div>
                  자기소개서 결과
                </h2>
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 h-full">
                  {loading ? (
                    <div className="flex items-center justify-center h-full min-h-[600px]">
                      <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                        <div className="text-gray-600 font-medium">자기소개서를 생성하고 있습니다...</div>
                        <div className="text-sm text-gray-500 mt-2">AI가 입력한 정보를 바탕으로 자기소개서를 작성해요</div>
                      </div>
                    </div>
                  ) : coverLetterContent ? (
                    <div className="space-y-4 h-full">
                      {/* 자기소개서 전체 내용 */}
                      <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-8 border border-gray-200 h-full">
                        {/* 제목 */}
                        <h3 className="text-2xl font-bold text-blue-600 mb-6 text-center">
                          {companyName} 자기소개서
                        </h3>
                        
                        {/* 전체 내용 */}
                        <div className="text-gray-800 leading-relaxed mb-6 text-lg flex-1">
                          <div className="whitespace-pre-wrap">
                            {coverLetterContent}
                          </div>
                        </div>
                        
                        {/* 글자 수 표시 */}
                        <div className="text-base text-gray-500 text-center mb-6">
                          공백포함 {coverLetterContent.replace(/\s/g, '').length}자
                        </div>
                      </div>
                      
                      {/* 액션 버튼들 */}
                      <div className="flex gap-3 flex-wrap">
                        <button 
                          onClick={handleDownloadCoverLetter}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                        >
                          <Download className="w-4 h-4" />
                          다운로드
                        </button>
                        <button 
                          onClick={handleCopyCoverLetter}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                        >
                          <Copy className="w-4 h-4" />
                          복사
                        </button>
                        <button 
                          onClick={resetForm}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg transform hover:scale-105"
                        >
                          <FileText className="w-4 h-4" />
                          새로 작성
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full min-h-[600px]">
                      <div className="text-center text-gray-500">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <div className="font-medium">자기소개서 결과가 여기에 표시됩니다</div>
                        <div className="text-sm mt-2">정보를 입력하고 자기소개서 생성을 시작해주세요</div>
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