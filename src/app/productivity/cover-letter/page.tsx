"use client";

import React, { useState } from "react";
import Header from '../../components/Header';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Copy, 
  Loader2, 
  Plus, 
  X, 
  HelpCircle, 
  Globe,
  Search as SearchIcon
} from "lucide-react";
import { useRouter } from "next/navigation";

interface QuestionItem {
  id: string;
  question: string;
  wordLimit?: number;
}

export default function CoverLetterPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [keyExperience, setKeyExperience] = useState("");
  const [coreSkills, setCoreSkills] = useState("");
  const [useSearchResults, setUseSearchResults] = useState(true);
  const [coverLetter, setCoverLetter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [companyInfo, setCompanyInfo] = useState<string | null>(null);
  const [loadingCompanyInfo, setLoadingCompanyInfo] = useState(false);
  const [isAnalyzingCompany, setIsAnalyzingCompany] = useState(false);
  const [companyAnalysis, setCompanyAnalysis] = useState<any>(null);
  const [writingStyle, setWritingStyle] = useState<'connected' | 'separated'>('connected');

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
    if (!companyName.trim()) return;

    setIsAnalyzingCompany(true);
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

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.companyAnalysis) {
          setCompanyAnalysis({
            ...data.companyAnalysis,
            originalCompanyName: companyName.trim()
          });
        }
      }
    } catch (error) {
      console.error('회사 분석 오류:', error);
    } finally {
      setIsAnalyzingCompany(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('companyName', companyName.trim());
      formData.append('jobTitle', jobTitle.trim());
      
      const combinedExperience = `${keyExperience.trim()}\n\n핵심 이력:\n${coreSkills.trim()}`.trim();
      formData.append('keyExperience', combinedExperience);
      
      formData.append('useSearchResults', useSearchResults.toString());
      
      const validQuestions = questions.filter(q => q.question.trim());
      formData.append('questions', JSON.stringify(validQuestions));
      
      if (companyAnalysis) {
        formData.append('companyAnalysis', JSON.stringify(companyAnalysis));
      }
      
      formData.append('writingStyle', writingStyle);

      const response = await fetch("/api/cover-letter", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setCoverLetter(data.coverLetterContent || data.coverLetter);
      } else {
        console.error("자기소개서 생성 실패");
      }
    } catch (error) {
      console.error("오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(coverLetter);
    alert("클립보드에 복사되었습니다!");
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-8">
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
            <h1 className="text-3xl font-bold text-gray-900">AI 자기소개서 작성</h1>
            <p className="text-gray-600 text-lg mt-2">
              AI가 당신의 경력과 역량을 바탕으로 맞춤형 자기소개서를 작성해드립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 입력 폼 */}
            <div className="space-y-6">
              {/* 회사명/학교명 */}
              <div className="bg-white rounded-lg shadow-md p-6">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  
                  {/* 회사 분석 버튼 */}
                  {(companyName.trim() || companyAnalysis) && (
                    <div className="mb-4">
                      <button
                        onClick={analyzeCompany}
                        disabled={isAnalyzingCompany || !companyName.trim()}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isAnalyzingCompany ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            회사 공식 사이트 분석 중...
                          </>
                        ) : (
                          <>
                            <Globe className="w-4 h-4" />
                            {companyAnalysis ? '회사 정보 재분석' : '회사 공식 사이트 분석'}
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {/* 회사 정보 표시 */}
                  {loadingCompanyInfo && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-blue-700 font-medium">
                          {companyName}에 대한 정보를 검색하고 있습니다...
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {companyInfo && !loadingCompanyInfo && (
                    <div className="p-3 bg-green-50 rounded-md border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <h3 className="text-sm font-semibold text-gray-800">{companyName} 정보</h3>
                      </div>
                      <div className="text-sm text-gray-700 leading-relaxed max-h-24 overflow-y-auto">
                        {companyInfo}
                      </div>
                    </div>
                  )}

                  {/* 회사 분석 결과 */}
                  {companyAnalysis && (
                    <div className="bg-blue-50 rounded-md p-4 border border-blue-200">
                      <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        {companyAnalysis.originalCompanyName || companyName} 공식 사이트 분석 결과
                      </h3>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-white rounded p-3 border border-blue-200">
                          <h4 className="font-medium text-blue-900 mb-1 text-sm">🎯 핵심가치</h4>
                          <div className="flex flex-wrap gap-1">
                            {companyAnalysis.coreValues?.map((value: string, idx: number) => (
                              <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                {value}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white rounded p-3 border border-blue-200">
                          <h4 className="font-medium text-blue-900 mb-1 text-sm">👤 인재상</h4>
                          <p className="text-xs text-blue-800">{companyAnalysis.idealCandidate}</p>
                        </div>

                        <div className="bg-white rounded p-3 border border-blue-200">
                          <h4 className="font-medium text-blue-900 mb-1 text-sm">🌟 비전/미션</h4>
                          <p className="text-xs text-blue-800">{companyAnalysis.vision}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 지원 직무/지원 학과 */}
              <div className="bg-white rounded-lg shadow-md p-6">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>

              {/* 회사별 자기소개서 질문 문항 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-gray-900">자기소개서 질문 문항</h2>
                  </div>
                  <button
                    onClick={addQuestion}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                    disabled={isLoading}
                  >
                    <Plus className="w-4 h-4" />
                    질문 추가
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">지원하는 회사에서 요구하는 자기소개서 질문들을 입력해주세요. AI가 이 질문들에 맞는 자기소개서를 작성해드립니다.</p>
                
                <div className="space-y-4">
                  {questions.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">질문 추가 버튼을 클릭하여 자기소개서 질문을 추가해주세요</p>
                      <p className="text-xs text-gray-400 mt-1">예: 지원 동기를 작성해주세요, 본인의 강점을 설명해주세요</p>
                    </div>
                  ) : (
                    questions.map((question, index) => (
                      <div key={question.id} className="border border-gray-200 rounded-md p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-700">질문 {index + 1}</h4>
                          <button
                            onClick={() => removeQuestion(question.id)}
                            className="text-red-500 hover:text-red-700"
                            disabled={isLoading}
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isLoading}
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
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isLoading}
                              />
                              <span className="text-sm text-gray-500 whitespace-nowrap">자</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 대표 경험 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">대표 경험 (상황 중심)</h2>
                  <span className="text-sm text-red-500 font-medium">*</span>
                  <div className="relative group">
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      구체적인 상황과 성과를 중심으로<br/>
                      본인이 경험한 주요 프로젝트나 업무를 입력해주세요.
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
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={3}
                    disabled={isLoading}
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {keyExperience.length}/500
                  </div>
                </div>
              </div>

              {/* 보유 이력 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">보유 이력 (기술/자격 중심)</h2>
                  <span className="text-sm text-red-500 font-medium">*</span>
                  <div className="relative group">
                    <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      보유한 자격증, 기술 스킬,<br/>
                      언어 능력, 학력 등을 입력해주세요.
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
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                    disabled={isLoading}
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {coreSkills.length}/500
                  </div>
                </div>
              </div>

              {/* 작성 방식 선택 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">작성 방식 선택</h2>
                <p className="text-sm text-gray-600 mb-4">자기소개서를 어떤 방식으로 작성할지 선택해주세요</p>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="writingStyle"
                      value="connected"
                      checked={writingStyle === 'connected'}
                      onChange={(e) => setWritingStyle(e.target.value as 'connected' | 'separated')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">연결형</div>
                      <div className="text-sm text-gray-600">모든 질문을 하나의 자연스러운 자기소개서로 연결</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="writingStyle"
                      value="separated"
                      checked={writingStyle === 'separated'}
                      onChange={(e) => setWritingStyle(e.target.value as 'connected' | 'separated')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">분리형</div>
                      <div className="text-sm text-gray-600">각 질문별로 개별 답변 작성 (CJ제일제당, 삼성웰스토리 등)</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 인터넷 검색 결과 활용 */}
              <div className="bg-white rounded-lg shadow-md p-6">
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
                onClick={handleSubmit}
                disabled={!companyName.trim() || !jobTitle.trim() || !keyExperience.trim() || isLoading}
                className="w-full bg-blue-500 text-white py-3 px-4 rounded-md hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
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
            </div>

            {/* 결과 영역 */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">자기소개서 결과</h2>
              {coverLetter ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-md">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800">{coverLetter}</pre>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      복사
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([coverLetter], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${companyName}_자기소개서.txt`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      다운로드
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>자기소개서 결과가 여기에 표시됩니다</p>
                  <p className="text-sm mt-2">정보를 입력하고 자기소개서 생성을 시작해주세요</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 