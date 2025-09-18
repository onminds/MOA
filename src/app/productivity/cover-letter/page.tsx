"use client";

import React, { useState, useMemo } from "react";
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
  User,
  Lightbulb,
  CheckCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { useToast } from "@/contexts/ToastContext";
import { createUsageToastData, createUsageToastMessage } from "@/lib/toast-utils";
import LogoLoading from '@/components/LogoLoading';
import CoverLetterEditorEmbed from '@/components/CoverLetterEditorEmbed';

interface QuestionItem {
  id: string;
  question: string;
  wordLimit?: number;
}

export default function CoverLetterPage() {
  const router = useRouter();
  const { showToast } = useToast();
  type Step = 'company' | 'questions' | 'experience' | 'result';
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [keyExperience, setKeyExperience] = useState("");
  const [coreSkills, setCoreSkills] = useState("");
  const [useSearchResults, setUseSearchResults] = useState(true);
  const [coverLetter, setCoverLetter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('company');
  const [questions, setQuestions] = useState<QuestionItem[]>([
    { id: `${Date.now()}`, question: '' }
  ]);
  const [companyInfo, setCompanyInfo] = useState<string | null>(null);
  const [loadingCompanyInfo, setLoadingCompanyInfo] = useState(false);
  const [isAnalyzingCompany, setIsAnalyzingCompany] = useState(false);
  const [companyAnalysis, setCompanyAnalysis] = useState<any>(null);
  // 작성 방식 선택 제거: 항상 질문별(분리형)
  const [manualInputMode, setManualInputMode] = useState(false);

  const addQuestion = () => {
    const newQuestion: QuestionItem = {
      id: Date.now().toString(),
      question: '',
      // 글자 수 제한은 기본값 없음 (빈 값 허용)
    };
    setQuestions([...questions, newQuestion]);
  };

  const removeQuestion = (id: string) => {
    if (questions.length <= 1) return; // 최소 1개 유지
    const firstId = questions[0]?.id;
    if (id === firstId) return; // 첫 번째 질문 삭제 불가
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, value: string) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, question: value } : q
    ));
  };

  const updateQuestionWordLimit = (id: string, wordLimit: number | undefined) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, ...(wordLimit === undefined ? { wordLimit: undefined } : { wordLimit }) } : q
    ));
  };

  // 회사 정보 검색
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
      // 보유 이력 별도 전송(서버 필수 검증용)
      formData.append('coreSkills', coreSkills.trim());
      
      formData.append('useSearchResults', useSearchResults.toString());
      
      const validQuestions = questions.filter(q => q.question.trim());
      formData.append('questions', JSON.stringify(validQuestions));
      
      if (companyAnalysis) {
        formData.append('companyAnalysis', JSON.stringify(companyAnalysis));
      }
      // 작성 방식 전송 제거 (항상 분리형)

      const response = await fetch("/api/cover-letter", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.coverLetterContent || data.coverLetter;
        setCoverLetter(content);
        setCurrentStep('result');
        // 생성 직후 페이지 내 에디터 표시를 위해 상태 유지(아래 내장 에디터가 content를 사용)
        // 사용량 증가 Toast 알림 표시 (실제 사용량 데이터 사용)
        if (data.usage) {
          const toastData = createUsageToastData('cover-letter', data.usage.current, data.usage.limit);
          showToast({
            type: 'success',
            title: `${toastData.serviceName} 사용`,
            message: createUsageToastMessage(toastData),
            duration: 5000
          });
        } else {
          // Fallback to hardcoded values if usage data is not available
          const toastData = createUsageToastData('cover-letter', 0, 30);
          showToast({
            type: 'success',
            title: `${toastData.serviceName} 사용`,
            message: createUsageToastMessage(toastData),
            duration: 5000
          });
        }
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

  const editorSrc = useMemo(() => {
    if (!coverLetter) return '';
    try {
      const key = `essay-${Date.now()}`;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, coverLetter);
      }
      return `/essay-editor?storageKey=${encodeURIComponent(key)}`;
    } catch {
      return `/essay-editor?text=${encodeURIComponent(coverLetter.slice(0, 3000))}`;
    }
  }, [coverLetter]);

  const canProceedCompany = companyName.trim();
  const hasValidQuestions = jobTitle.trim() && questions.filter(q => q.question.trim()).length > 0;
  const canProceedExperience = keyExperience.trim() && coreSkills.trim();

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-8">
        <div className="max-w-screen-2xl mx-auto">
          {/* 뒤로가기 버튼 */}
          <div className="mb-6 flex items-center justify-start">
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

          {/* 단계 표시 바 - 제목/소개 아래 중앙 정렬 */}
          <div className="mb-8 flex justify-center">
            <div className="hidden md:flex items-center justify-between bg-white rounded-xl p-4 shadow-sm w-full max-w-[720px]">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                currentStep === 'company' ? 'bg-indigo-100 text-indigo-700 font-semibold' : ['questions','experience','result'].includes(currentStep) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                <User className="w-4 h-4" />
                정보 입력
              </div>
              <div className="flex-grow h-0.5 bg-gray-200 mx-2"></div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                currentStep === 'questions' ? 'bg-indigo-100 text-indigo-700 font-semibold' : ['experience','result'].includes(currentStep) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                <Lightbulb className="w-4 h-4" />
                질문 문항
              </div>
              <div className="flex-grow h-0.5 bg-gray-200 mx-2"></div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                currentStep === 'experience' ? 'bg-indigo-100 text-indigo-700 font-semibold' : currentStep === 'result' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}>
                <FileText className="w-4 h-4" />
                경험/이력
              </div>
              <div className="flex-grow h-0.5 bg-gray-200 mx-2"></div>
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                currentStep === 'result' ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'bg-emerald-100 text-emerald-700'
              }`}>
                <CheckCircle className="w-4 h-4" />
                결과
              </div>
            </div>
          </div>

          {/* 단계별 컨텐츠 또는 로딩 */}
          {isLoading ? (
            <div className="max-w-4xl mx-auto">
              <div className="rounded-2xl p-12 flex items-center justify-center min-h-[360px]">
                <LogoLoading message="자기소개서 생성 중..." subMessage="AI가 내용을 정교하게 작성하고 있어요" transparentBg />
              </div>
            </div>
          ) : currentStep !== 'result' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {currentStep === 'company' && (
                <>
              {/* 회사명 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">회사명</h2>
                  <span className="text-sm text-red-500 font-medium">*</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">지원하는 회사의 정확한 명칭을 입력해주세요</p>
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
                  {(companyName.trim() || companyAnalysis) && (
                        <div className="mb-2 flex items-center gap-3">
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
                      {!manualInputMode && (
                        <button
                          onClick={() => {
                            setManualInputMode(prev => {
                              const next = !prev;
                              if (next && !companyAnalysis) {
                                setCompanyAnalysis({
                                  coreValues: [],
                                  idealCandidate: '',
                                  vision: '',
                                  companyCulture: '',
                                  businessAreas: [],
                                  keyCompetencies: [],
                                  originalCompanyName: companyName.trim()
                                });
                              }
                              return next;
                            });
                          }}
                          className={`px-3 py-2 rounded-md border transition-colors bg-white text-gray-700 border-gray-300 hover:bg-gray-50`}
                        >
                          수동 입력
                        </button>
                      )}
                    </div>
                  )}
                  
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

                  {companyAnalysis && !manualInputMode && (
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
                        {Array.isArray(companyAnalysis.businessAreas) && companyAnalysis.businessAreas.length > 0 && (
                          <div className="bg-white rounded p-3 border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-1 text-sm">💼 주요 사업분야</h4>
                            <div className="flex flex-wrap gap-1">
                              {companyAnalysis.businessAreas.map((area: string, idx: number) => (
                                <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">{area}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {companyAnalysis.companyCulture && (
                          <div className="bg-white rounded p-3 border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-1 text-sm">🏢 회사 문화</h4>
                            <p className="text-xs text-blue-800">{companyAnalysis.companyCulture}</p>
                          </div>
                        )}
                        {Array.isArray(companyAnalysis.keyCompetencies) && companyAnalysis.keyCompetencies.length > 0 && (
                          <div className="bg-white rounded p-3 border border-blue-200">
                            <h4 className="font-medium text-blue-900 mb-1 text-sm">💪 중요 역량</h4>
                            <div className="flex flex-wrap gap-1">
                              {companyAnalysis.keyCompetencies.map((c: string, idx: number) => (
                                <span key={idx} className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 text-right">
                        <button
                          onClick={() => setManualInputMode(true)}
                          className="inline-flex items-center text-blue-700 hover:text-blue-900 text-xs font-medium underline underline-offset-2"
                        >
                          편집하기
                        </button>
                      </div>
                    </div>
                  )}

                  {companyAnalysis && manualInputMode && (
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-md p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          {companyAnalysis.originalCompanyName || companyName || '회사'} 분석 정보 직접 입력
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-white rounded p-3 border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-2 text-sm">🎯 핵심가치</h4>
                          <textarea
                            placeholder="쉼표(,)로 구분 (예: 혁신, 성장, 협업)"
                            value={(companyAnalysis.coreValues || []).join(', ')}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, coreValues: e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s) })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="bg-white rounded p-3 border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-2 text-sm">👤 인재상</h4>
                          <textarea
                            placeholder="회사가 원하는 인재상"
                            value={companyAnalysis.idealCandidate || ''}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, idealCandidate: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="bg-white rounded p-3 border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-2 text-sm">🌟 비전/미션</h4>
                          <textarea
                            placeholder="회사 비전/미션"
                            value={companyAnalysis.vision || ''}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, vision: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="bg-white rounded p-3 border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-2 text-sm">🏢 회사 문화</h4>
                          <textarea
                            placeholder="회사 문화"
                            value={companyAnalysis.companyCulture || ''}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, companyCulture: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="bg-white rounded p-3 border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-2 text-sm">💼 주요 사업분야</h4>
                          <textarea
                            placeholder="쉼표(,)로 구분 (예: AI, 클라우드)"
                            value={(companyAnalysis.businessAreas || []).join(', ')}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, businessAreas: e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s) })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="bg-white rounded p-3 border border-gray-200">
                          <h4 className="font-medium text-gray-900 mb-2 text-sm">💪 중요 역량</h4>
                          <textarea
                            placeholder="쉼표(,)로 구분 (예: 문제해결능력, 소통능력)"
                            value={(companyAnalysis.keyCompetencies || []).join(', ')}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, keyCompetencies: e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s) })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black text-sm"
                            rows={2}
                          />
                        </div>
                      </div>
                      <div className="mt-3 text-right">
                        <button
                          onClick={() => setManualInputMode(false)}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700"
                        >
                          저장하기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

                  {/* 지원 직무: 2단계로 이동 (여기서는 숨김) */}
                </>
              )}

              {currentStep === 'questions' && (
                <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
              {/* 지원 직무 */}
                  <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-xl font-semibold text-gray-900">지원 직무</h2>
                  <span className="text-sm text-red-500 font-medium">*</span>
                </div>
                <p className="text-sm text-gray-600 mb-4">지원하는 직무를 정확히 입력해주세요</p>
                <input
                  type="text"
                  placeholder="직무명"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-gray-900">자기소개서 질문 문항</h2>
                    <span className="text-sm text-red-500 font-medium">*</span>
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
                  <p className="text-sm text-gray-600 mb-4">지원하는 회사에서 요구하는 자기소개서 질문을 입력해주세요</p>
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
                          {index > 0 && (
                            <button
                              onClick={() => removeQuestion(question.id)}
                              className="text-red-500 hover:text-red-700"
                              disabled={isLoading}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">질문</label>
                            <input
                              type="text"
                                placeholder={index === 0 ? '예: 지원 동기를 작성해주세요' : '예: 본인의 강점을 설명해주세요'}
                              value={question.question}
                              onChange={(e) => updateQuestion(question.id, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={isLoading}
                            />
                            {index === 0 && !question.question.trim() && (
                              <p className="text-xs text-red-500 mt-1">필수 질문입니다</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              글자 수 제한 (선택)
                              <span className="text-xs text-gray-500 ml-1">0 = 제한 없음</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="\\d*"
                                  placeholder="예: 500 (비우면 제한 없음)"
                                  value={
                                    typeof question.wordLimit === 'number' && !Number.isNaN(question.wordLimit)
                                      ? String(question.wordLimit)
                                      : ''
                                  }
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^\d]/g, '');
                                    if (raw === '') {
                                      updateQuestionWordLimit(question.id, undefined);
                                      return;
                                    }
                                    const normalized = raw.replace(/^0+(?=\d)/, '');
                                    const num = parseInt(normalized, 10);
                                    updateQuestionWordLimit(
                                      question.id,
                                      Number.isFinite(num) ? Math.min(Math.max(num, 0), 2000) : undefined
                                    );
                                  }}
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
              )}

              {currentStep === 'experience' && (
                <>
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
                        rows={6}
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
                        rows={5}
                    disabled={isLoading}
                  />
                  <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                    {coreSkills.length}/500
                  </div>
                </div>
              </div>

                  {/* 인터넷 검색 결과 활용: 필수 적용 (UI 숨김) */}
                </>
              )}

              {/* 하단 네비게이션 */}
              <div className="flex items-center justify-between pt-2">
                  <button
                  onClick={() => setCurrentStep(prev => prev === 'company' ? 'company' : prev === 'questions' ? 'company' : 'questions')}
                  disabled={currentStep === 'company' || isLoading}
                  className={`px-4 py-2 rounded-md border text-gray-700 bg-white hover:bg-gray-50 transition-colors ${currentStep === 'company' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  이전
                  </button>
                {currentStep === 'experience' ? (
              <button
                    onClick={(e) => handleSubmit(e as any)}
                    disabled={!canProceedExperience || !canProceedCompany || !hasValidQuestions || isLoading}
                    className="px-4 py-2 rounded-md bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    자기소개서 생성
              </button>
                ) : (
                  <button
                    onClick={() => setCurrentStep(prev => prev === 'company' ? 'questions' : 'experience')}
                    disabled={
                      (currentStep === 'company' && !canProceedCompany) ||
                      (currentStep === 'questions' && !hasValidQuestions) ||
                      isLoading
                    }
                    className="px-4 py-2 rounded-md bg-black text-white font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                )}
                          </div>
                              </div>
          )}

          {/* 결과 화면: 에디터만 표시 */}
          {currentStep === 'result' && (
            <div className="bg-white rounded-lg shadow-md p-6 max-w-7xl mx-auto">
              <div className="flex items-start justify-end mb-4">
                    <button
                  onClick={() => setCurrentStep('company')}
                  className="text-sm text-gray-600 hover:text-gray-800 underline underline-offset-4"
                >
                  다시 작성하기
                    </button>
                  </div>
              {coverLetter && (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">자기소개서 결과</h3>
                  <CoverLetterEditorEmbed initialContent={coverLetter} initialTitle={companyName || '자기소개서'} height={560} layout="split" />
                </>
              )}
                </div>
              )}
        </div>
      </div>
    </>
  );
} 