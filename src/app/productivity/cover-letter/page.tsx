"use client";
import { useState } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, LogIn,
  ArrowLeft, FileText, Search as SearchIcon, Download, Copy, Loader2, X, Plus, HelpCircle, Paperclip, Edit3, Globe
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

interface QuestionItem {
  id: string;
  question: string;
  wordLimit?: number;
}

export default function CoverLetter() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [keyExperience, setKeyExperience] = useState('');
  const [coreSkills, setCoreSkills] = useState('');
  const [useSearchResults, setUseSearchResults] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [coverLetterContent, setCoverLetterContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [companyInfo, setCompanyInfo] = useState<string | null>(null);
  const [loadingCompanyInfo, setLoadingCompanyInfo] = useState(false);
  const [isAnalyzingCompany, setIsAnalyzingCompany] = useState(false);
  const [companyAnalysis, setCompanyAnalysis] = useState<{
    coreValues: string[];
    idealCandidate: string;
    vision: string;
    businessAreas: string[];
    companyCulture: string;
    keyCompetencies: string[];
    originalCompanyName?: string;
  } | null>(null);

  const addQuestion = () => {
    const newQuestion: QuestionItem = {
      id: Date.now().toString(),
      question: '',
      wordLimit: 0
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, value: string) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, question: value } : q
    ));
  };

  const updateQuestionWordLimit = (id: string, wordLimit: number) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, wordLimit } : q
    ));
  };

  // 회사/학교 정보 검색
  const searchCompanyInfo = async (company: string) => {
    if (!company.trim()) {
      setCompanyInfo(null);
      return;
    }

    setLoadingCompanyInfo(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: `${company} 회사 정보 기업문화 비전 미션`,
          maxResults: 3
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.results && data.results.length > 0) {
        const info = data.results.map((result: any) => result.snippet).join('\n\n');
        setCompanyInfo(info);
      } else {
        setCompanyInfo(null);
      }
    } catch (error) {
      console.error('회사 정보 검색 오류:', error);
      setCompanyInfo(null);
    } finally {
      setLoadingCompanyInfo(false);
    }
  };

  // 회사명 변경 시 정보 검색
  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCompanyName(value);
    
    // 입력값이 변경되면 기존 정보 초기화
    if (companyInfo) {
      setCompanyInfo(null);
    }
    if (companyAnalysis) {
      setCompanyAnalysis(null);
    }
  };

  // 회사명 입력 완료 후 정보 검색
  const handleCompanyNameBlur = () => {
    if (companyName.trim()) {
      searchCompanyInfo(companyName);
    }
  };

  // 회사 분석
  const analyzeCompany = async () => {
    if (!companyName.trim()) {
      setError('회사명을 입력해주세요.');
      return;
    }

    setIsAnalyzingCompany(true);
    setError(null);

    try {
      const response = await fetch('/api/interview-prep/analyze-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          jobTitle: jobTitle.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || '회사 분석에 실패했습니다.';
        const statusCode = response.status;
        
        let userFriendlyMessage = errorMessage;
        
        if (statusCode === 422) {
          userFriendlyMessage = 'AI 응답 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (statusCode === 503) {
          userFriendlyMessage = '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
        } else if (statusCode === 408) {
          userFriendlyMessage = '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
        } else if (statusCode === 400) {
          userFriendlyMessage = '입력 정보가 올바르지 않습니다. 회사명을 확인해주세요.';
        }
        
        throw new Error(userFriendlyMessage);
      }

      const data = await response.json();
      
      if (data.success && data.companyAnalysis) {
        setCompanyAnalysis({
          ...data.companyAnalysis,
          originalCompanyName: companyName.trim()
        });
      } else {
        throw new Error('회사 분석 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('회사 분석 오류:', error);
      setError(error instanceof Error ? error.message : '회사 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzingCompany(false);
    }
  };

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

    if (!keyExperience.trim() && !coreSkills.trim()) {
      setError('대표 경험이나 보유 이력을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('companyName', companyName.trim());
      formData.append('jobTitle', jobTitle.trim());
      
      // 강조할 경험과 핵심 이력을 합쳐서 전송
      const combinedExperience = `${keyExperience.trim()}\n\n핵심 이력:\n${coreSkills.trim()}`.trim();
      formData.append('keyExperience', combinedExperience);
      
      formData.append('useSearchResults', useSearchResults.toString());
      
      // 질문 문항들 추가
      const validQuestions = questions.filter(q => q.question.trim());
      formData.append('questions', JSON.stringify(validQuestions));
      
      // 회사 분석 정보 추가
      if (companyAnalysis) {
        formData.append('companyAnalysis', JSON.stringify(companyAnalysis));
      }
      
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
    setCoreSkills('');
    setUseSearchResults(true);
    setUploadedFile(null);
    setCoverLetterContent(null);
    setError(null);
    setQuestions([]);
    setCompanyInfo(null);
    setCompanyAnalysis(null);
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
                  
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="회사명"
                      value={companyName}
                      onChange={handleCompanyNameChange}
                      onBlur={handleCompanyNameBlur}
                      maxLength={50}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                      disabled={loading}
                    />
                    
                    {/* 회사 분석 버튼 */}
                    {(companyName.trim() || companyAnalysis) && (
                      <div className="mb-4">
                        <button
                          onClick={analyzeCompany}
                          disabled={isAnalyzingCompany || !companyName.trim()}
                          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isAnalyzingCompany ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              회사 공식 사이트 분석 중...
                            </>
                          ) : (
                            <>
                              <Globe className="w-5 h-5" />
                              {companyAnalysis ? '회사 정보 재분석' : '회사 공식 사이트 분석'}
                            </>
                          )}
                        </button>
                        {!companyName.trim() && companyAnalysis && (
                          <p className="text-sm text-gray-600 mt-2">
                            💡 회사명을 입력하면 새로운 회사를 분석할 수 있습니다.
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* 회사 정보 표시 */}
                    {loadingCompanyInfo && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-blue-700 font-medium">
                            {companyName}에 대한 정보를 검색하고 있습니다...
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {companyInfo && !loadingCompanyInfo && (
                      <div className="p-4 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border border-green-200">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-blue-600 rounded-full"></div>
                          <h3 className="text-sm font-semibold text-gray-800">{companyName} 정보</h3>
                        </div>
                        <div className="text-sm text-gray-700 leading-relaxed max-h-32 overflow-y-auto">
                          {companyInfo}
                        </div>
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <p className="text-xs text-gray-500">
                            💡 이 정보는 자기소개서 작성에 활용됩니다
                          </p>
                        </div>
                      </div>
                    )}

                    {/* 회사 분석 결과 */}
                    {companyAnalysis && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                        <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                          <Globe className="w-5 h-5" />
                          {companyAnalysis.originalCompanyName || companyName || '분석된 회사'} 공식 사이트 분석 결과
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">🎯 핵심가치</h4>
                            <div className="flex flex-wrap gap-2">
                              {companyAnalysis.coreValues.map((value, idx) => (
                                <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">
                                  {value}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">👤 인재상</h4>
                            <p className="text-sm text-blue-800">{companyAnalysis.idealCandidate}</p>
                          </div>

                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">🌟 비전/미션</h4>
                            <p className="text-sm text-blue-800">{companyAnalysis.vision}</p>
                          </div>

                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">🏢 회사 문화</h4>
                            <p className="text-sm text-blue-800">{companyAnalysis.companyCulture}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">💼 주요 사업분야</h4>
                            <div className="flex flex-wrap gap-2">
                              {companyAnalysis.businessAreas.map((area, idx) => (
                                <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm">
                                  {area}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-2">💪 중요 역량</h4>
                            <div className="flex flex-wrap gap-2">
                              {companyAnalysis.keyCompetencies.map((competency, idx) => (
                                <span key={idx} className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm">
                                  {competency}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-700">
                            ✨ 이 정보를 바탕으로 더욱 정확하고 맞춤형인 자기소개서를 작성해드립니다!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
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

                {/* 회사별 자기소개서 질문 문항 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-gray-900">자기소개서 질문 문항</h2>
                    </div>
                    <button
                      onClick={addQuestion}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm"
                      disabled={loading}
                    >
                      <Plus className="w-4 h-4" />
                      질문 추가
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">지원하는 회사에서 요구하는 자기소개서 질문들을 입력해주세요. AI가 이 질문들에 맞는 자기소개서를 작성해드립니다.</p>
                  
                  <div className="space-y-4">
                    {questions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Edit3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">질문 추가 버튼을 클릭하여 자기소개서 질문을 추가해주세요</p>
                        <p className="text-xs text-gray-400 mt-1">예: 지원 동기를 작성해주세요, 본인의 강점을 설명해주세요</p>
                      </div>
                    ) : (
                      questions.map((question, index) => (
                        <div key={question.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-700">질문 {index + 1}</h4>
                            <button
                              onClick={() => removeQuestion(question.id)}
                              className="text-red-500 hover:text-red-700"
                              disabled={loading}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">질문</label>
                              <input
                                type="text"
                                placeholder="예: 지원 동기를 작성해주세요"
                                value={question.question}
                                onChange={(e) => updateQuestion(question.id, e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                disabled={loading}
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                글자 수 제한 (선택)
                                <span className="text-xs text-gray-500 ml-1">0 = 제한 없음</span>
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="2000"
                                  placeholder="예: 500"
                                  value={question.wordLimit || 0}
                                  onChange={(e) => updateQuestionWordLimit(question.id, parseInt(e.target.value) || 0)}
                                  className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                  disabled={loading}
                                />
                                <span className="text-sm text-gray-500 whitespace-nowrap">자</span>
                              </div>
                              {question.wordLimit && question.wordLimit > 0 && (
                                <p className="text-xs text-blue-600 mt-1">
                                  💡 AI가 {question.wordLimit}자 이내로 답변을 작성합니다
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 강조할 경험과 핵심 이력을 별도 필드로 분리 */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">대표 경험 (상황 중심)</h2>
                    <span className="text-sm text-red-500 font-medium">*</span>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        <div className="text-center">
                          <div className="font-semibold mb-1">대표 경험이란?</div>
                          <div className="text-gray-200 leading-relaxed">
                            구체적인 상황과 성과를 중심으로<br/>
                            본인이 경험한 주요 프로젝트나 업무를 입력해주세요.<br/>
                            예: &quot;웹 개발 프로젝트 3개 완료&quot;, &quot;팀 리더 경험&quot;,<br/>
                            &quot;매출 20% 증가 달성&quot; 등
                          </div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">구체적인 상황과 성과를 중심으로 한 주요 경험을 입력해 주세요</p>
                  
                  <div className="relative">
                    <textarea
                      placeholder="구체적인 상황과 성과를 중심으로 한 주요 경험을 입력해 주세요"
                      value={keyExperience}
                      onChange={(e) => setKeyExperience(e.target.value)}
                      maxLength={300}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 resize-none"
                      rows={3}
                      disabled={loading}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {keyExperience.length}/300
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">보유 이력 (기술/자격 중심)</h2>
                    <span className="text-sm text-red-500 font-medium">*</span>
                    <div className="relative group">
                      <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                        <div className="text-center">
                          <div className="font-semibold mb-1">보유 이력이란?</div>
                          <div className="text-gray-200 leading-relaxed">
                            보유한 자격증, 기술 스킬,<br/>
                            언어 능력, 학력 등을 입력해주세요.<br/>
                            예: &quot;관련 자격증 보유&quot;, &quot;영어 회화 가능&quot;,<br/>
                            &quot;React, Node.js 숙련&quot; 등
                          </div>
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">보유한 자격증, 기술 스킬, 언어 능력 등을 입력해 주세요</p>
                  
                  <div className="relative">
                    <textarea
                      placeholder="보유한 자격증, 기술 스킬, 언어 능력 등을 입력해 주세요"
                      value={coreSkills}
                      onChange={(e) => setCoreSkills(e.target.value)}
                      maxLength={200}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 resize-none"
                      rows={2}
                      disabled={loading}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                      {coreSkills.length}/200
                    </div>
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