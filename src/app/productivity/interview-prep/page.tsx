"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  ArrowLeft, Briefcase, Building2, User, Clock, Lightbulb, CheckCircle, 
  Play, Pause, RotateCcw, Download, Copy, Loader2, AlertCircle, Star,
  Mic, MicOff, Volume2, TrendingUp, BarChart3, Globe
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface VoiceAnalysisResult {
  confidence: number;
  pace: number;
  volume: number;
  tone: 'calm' | 'nervous' | 'confident' | 'excited';
  clarity: number;
}

interface VoiceEvaluationResult {
  overallScore: number;
  tone: string;
  pace: string;
  volume: string;
  clarity: string;
  confidence: string;
  strengths: string[];
  improvements: string[];
  recommendations: string[];
}

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

type InterviewStep = 'input' | 'questions' | 'practice' | 'feedback';

interface InterviewQuestion {
  id: number;
  category: string;
  question: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tips: string[];
  answer?: string;
  feedback?: string;
  score?: number;
  evaluation?: {
    totalScore: number;
    scores: {
      clarity: number;
      specificity: number;
      relevance: number;
      structure: number;
      impact: number;
    };
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    improvedExample: string;
  };
  evaluating?: boolean;
}

export default function InterviewPrep() {
  const router = useRouter();
  
  // 단계 관리
  const [currentStep, setCurrentStep] = useState<InterviewStep>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 회사 분석 상태
  const [isAnalyzingCompany, setIsAnalyzingCompany] = useState(false);
  const [companyAnalysis, setCompanyAnalysis] = useState<{
    coreValues: string[];
    idealCandidate: string;
    vision: string;
    businessAreas: string[];
    companyCulture: string;
    keyCompetencies: string[];
  } | null>(null);
  
  // 입력 정보
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [careerLevel, setCareerLevel] = useState('junior'); // junior, mid, senior
  
  // 면접 질문 및 답변
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerTime, setAnswerTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // 음성 분석 상태
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceAnalysis, setVoiceAnalysis] = useState<VoiceAnalysisResult | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isEvaluatingVoice, setIsEvaluatingVoice] = useState(false);
  const [voiceEvaluation, setVoiceEvaluation] = useState<VoiceEvaluationResult | null>(null);
  
  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 타이머 관리
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setAnswerTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTimerRunning]);

  // 시간 포맷팅
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
        throw new Error(errorData.error || '회사 분석에 실패했습니다.');
      }

      const data = await response.json();
      
      if (data.success && data.companyAnalysis) {
        setCompanyAnalysis(data.companyAnalysis);
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

  // 면접 질문 생성
  const generateQuestions = async () => {
    if (!companyName.trim() || !jobTitle.trim()) {
      setError('회사명과 직무를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/interview-prep/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: companyName.trim(),
          jobTitle: jobTitle.trim(),
          careerLevel,
          jobDescription: jobDescription.trim(),
          experience: experience.trim(),
          skills: skills.trim(),
          companyAnalysis: companyAnalysis
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '면접 질문 생성에 실패했습니다.');
      }

      const data = await response.json();
      
      if (data.success && data.questions) {
        setQuestions(data.questions);
        setCurrentStep('questions');
      } else {
        throw new Error('면접 질문을 받지 못했습니다.');
      }
    } catch (error) {
      console.error('질문 생성 오류:', error);
      setError(error instanceof Error ? error.message : '면접 질문 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 답변 저장
  const saveAnswer = (questionId: number, answer: string) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, answer } : q
    ));
  };

  // 답변 평가
  const evaluateAnswer = async (questionId: number) => {
    const question = questions.find(q => q.id === questionId);
    if (!question || !question.answer || question.answer.trim().length < 10) {
      setError('답변을 10자 이상 작성해주세요.');
      return;
    }

    // 평가 중 상태로 설정
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, evaluating: true } : q
    ));

    try {
      const response = await fetch('/api/interview-prep/evaluate-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question.question,
          answer: question.answer,
          category: question.category,
          jobTitle,
          companyName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '답변 평가에 실패했습니다.');
      }

      const data = await response.json();
      
      if (data.success && data.evaluation) {
        setQuestions(prev => prev.map(q => 
          q.id === questionId ? { 
            ...q, 
            evaluation: data.evaluation,
            evaluating: false 
          } : q
        ));
      } else {
        throw new Error('평가 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('답변 평가 오류:', error);
      setError(error instanceof Error ? error.message : '답변 평가 중 오류가 발생했습니다.');
      
      // 평가 실패 시 상태 원복
      setQuestions(prev => prev.map(q => 
        q.id === questionId ? { ...q, evaluating: false } : q
      ));
    }
  };

  // 연습 모드 시작
  const startPractice = () => {
    setCurrentStep('practice');
  };

  // 타이머 시작/정지
  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  // 타이머 리셋
  const resetTimer = () => {
    setIsTimerRunning(false);
    setAnswerTime(0);
  };

  // 다음 질문
  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      resetTimer();
    } else {
      // 모든 질문 완료
      setCurrentStep('feedback');
    }
  };

  // 이전 질문
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      resetTimer();
    }
  };

  // 처음부터 다시 시작
  const restartInterview = () => {
    setCurrentStep('input');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswerTime(0);
    setCompanyName('');
    setJobTitle('');
    setJobDescription('');
    setExperience('');
    setSkills('');
    setError(null);
  };

  // 텍스트 복사
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: 토스트 알림 추가
  };

  // 음성 녹음 시작
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      streamRef.current = stream;
      
      // AudioContext 설정
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // MediaRecorder 설정 - 녹음 데이터 수집
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
        setRecordedAudio(audioBlob);
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordedAudio(null);
      setVoiceEvaluation(null);
      
      // 실시간 음성 레벨 모니터링 시작
      startAudioLevelMonitoring();
      
    } catch (error) {
      console.error('마이크 접근 오류:', error);
      setError('마이크에 접근할 수 없습니다. 브라우저 설정을 확인해주세요.');
    }
  };

  // 음성 녹음 정지
  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setIsRecording(false);
    setAudioLevel(0);
  }, [isRecording]);

  // 실시간 음성 레벨 모니터링
  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateLevel = () => {
      if (!analyserRef.current || !isRecording) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // 음성 레벨 계산
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.min(average / 128, 1);
      setAudioLevel(normalizedLevel);
      
      // 음성 분석 수행
      performVoiceAnalysis(dataArray, normalizedLevel);
      
      if (isRecording) {
        requestAnimationFrame(updateLevel);
      }
    };
    
    updateLevel();
  };

  // 음성 분석 수행
  const performVoiceAnalysis = (frequencyData: Uint8Array, volume: number) => {
    if (!frequencyData || frequencyData.length === 0) return;
    
    // 기본 음성 특성 분석
    const highFreq = frequencyData.slice(Math.floor(frequencyData.length * 0.7)).reduce((sum, val) => sum + val, 0);
    const midFreq = frequencyData.slice(Math.floor(frequencyData.length * 0.3), Math.floor(frequencyData.length * 0.7)).reduce((sum, val) => sum + val, 0);
    const lowFreq = frequencyData.slice(0, Math.floor(frequencyData.length * 0.3)).reduce((sum, val) => sum + val, 0);
    
    const totalEnergy = highFreq + midFreq + lowFreq;
    
    if (totalEnergy > 0) {
      // 신뢰도 계산 (음성의 안정성)
      const confidence = Math.min((midFreq / totalEnergy) * 100, 100);
      
      // 말하기 속도 (고주파 대비)
      const pace = Math.min((highFreq / totalEnergy) * 100, 100);
      
      // 명료도 (전체적인 에너지 분포)
      const clarity = Math.min(((highFreq + midFreq) / totalEnergy) * 100, 100);
      
      // 톤 분석
      let tone: 'calm' | 'nervous' | 'confident' | 'excited';
      if (volume > 0.7 && pace > 60) {
        tone = 'excited';
      } else if (volume > 0.5 && confidence > 60) {
        tone = 'confident';
      } else if (volume < 0.3 || pace < 30) {
        tone = 'nervous';
      } else {
        tone = 'calm';
      }
      
      setVoiceAnalysis({
        confidence: Math.round(confidence),
        pace: Math.round(pace),
        volume: Math.round(volume * 100),
        tone,
        clarity: Math.round(clarity)
      });
    }
  };

  // AI 음성 평가
  const evaluateVoiceWithAI = async () => {
    if (!recordedAudio) {
      setError('녹음된 음성이 없습니다. 먼저 녹음을 진행해주세요.');
      return;
    }

    setIsEvaluatingVoice(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', recordedAudio, 'recording.webm');
      formData.append('question', questions[currentQuestionIndex].question);
      formData.append('category', questions[currentQuestionIndex].category);

      const response = await fetch('/api/interview-prep/evaluate-voice', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '음성 평가에 실패했습니다.');
      }

      const data = await response.json();
      
      if (data.success && data.evaluation) {
        setVoiceEvaluation(data.evaluation);
      } else {
        throw new Error('음성 평가 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('음성 평가 오류:', error);
      setError(error instanceof Error ? error.message : '음성 평가 중 오류가 발생했습니다.');
    } finally {
      setIsEvaluatingVoice(false);
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopVoiceRecording();
    };
  }, [stopVoiceRecording]);

  // 답변 다운로드
  const downloadAnswers = () => {
    const content = questions.map((q, index) => 
      `Q${index + 1}. ${q.question}\n\nA${index + 1}. ${q.answer || '(답변 없음)'}\n\n---\n\n`
    ).join('');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName}_${jobTitle}_면접준비_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <div className="max-w-4xl mx-auto">
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
                <div className="bg-pink-500 p-3 rounded-xl">
                  <Briefcase className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">면접 준비</h1>
                  <p className="text-gray-800 mt-1">AI가 생성한 맞춤형 면접 질문으로 완벽하게 준비하세요</p>
                </div>
              </div>

              {/* 진행 단계 표시 */}
              <div className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  currentStep === 'input' ? 'bg-pink-100 text-pink-700' : 
                  ['questions', 'practice', 'feedback'].includes(currentStep) ? 'bg-green-100 text-green-700' : 
                  'bg-gray-100 text-gray-500'
                }`}>
                  <User className="w-4 h-4" />
                  정보 입력
                </div>
                <div className="w-8 h-0.5 bg-gray-200"></div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  currentStep === 'questions' ? 'bg-pink-100 text-pink-700' : 
                  ['practice', 'feedback'].includes(currentStep) ? 'bg-green-100 text-green-700' : 
                  'bg-gray-100 text-gray-500'
                }`}>
                  <Lightbulb className="w-4 h-4" />
                  질문 생성
                </div>
                <div className="w-8 h-0.5 bg-gray-200"></div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  currentStep === 'practice' ? 'bg-pink-100 text-pink-700' : 
                  currentStep === 'feedback' ? 'bg-green-100 text-green-700' : 
                  'bg-gray-100 text-gray-500'
                }`}>
                  <Play className="w-4 h-4" />
                  연습 모드
                </div>
                <div className="w-8 h-0.5 bg-gray-200"></div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                  currentStep === 'feedback' ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  <CheckCircle className="w-4 h-4" />
                  피드백
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

            {/* 1단계: 정보 입력 */}
            {currentStep === 'input' && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Building2 className="w-6 h-6" />
                  지원 정보 입력
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  {/* 회사명 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      회사명 *
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="예: 네이버, 카카오, 삼성전자"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-500 text-black"
                    />
                  </div>

                  {/* 직무명 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      지원 직무 *
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="예: 프론트엔드 개발자, 마케팅 기획자"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-500 text-black"
                    />
                  </div>
                </div>

                {/* 회사 분석 버튼 */}
                {companyName.trim() && (
                  <div className="mb-6">
                    <button
                      onClick={analyzeCompany}
                      disabled={isAnalyzingCompany}
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
                  </div>
                )}

                {/* 회사 분석 결과 */}
                {companyAnalysis && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      {companyName} 공식 사이트 분석 결과
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
                        ✨ 이 정보를 바탕으로 더욱 정확하고 맞춤형인 면접 질문을 생성해드립니다!
                      </p>
                    </div>
                  </div>
                )}

                {/* 경력 수준 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    경력 수준
                  </label>
                  <div className="flex gap-4">
                    {[
                      { value: 'junior', label: '신입/주니어 (0-2년)' },
                      { value: 'mid', label: '미드레벨 (3-7년)' },
                      { value: 'senior', label: '시니어 (8년+)' }
                    ].map((level) => (
                      <label key={level.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="careerLevel"
                          value={level.value}
                          checked={careerLevel === level.value}
                          onChange={(e) => setCareerLevel(e.target.value)}
                          className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                        />
                        <span className="text-sm text-gray-900">{level.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 직무 설명 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    직무 설명 (선택사항)
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="채용공고의 주요 업무나 자격요건을 입력하면 더 정확한 질문을 생성할 수 있습니다."
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-500 text-black"
                  />
                </div>

                {/* 주요 경험 */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    주요 경험 및 프로젝트
                  </label>
                  <textarea
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    placeholder="관련 경험, 프로젝트, 성과 등을 입력해주세요. 이를 바탕으로 맞춤형 질문을 생성합니다."
                    rows={4}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-500 text-black"
                  />
                </div>

                {/* 핵심 스킬 */}
                <div className="mb-8">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    핵심 스킬 및 역량
                  </label>
                  <input
                    type="text"
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="예: React, Node.js, AWS, 프로젝트 관리, 데이터 분석"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-500 text-black"
                  />
                  <p className="text-sm text-gray-800 mt-1">쉼표(,)로 구분해서 입력해주세요</p>
                </div>

                {/* 질문 생성 버튼 */}
                <div className="text-center">
                  <button
                    onClick={generateQuestions}
                    disabled={loading || !companyName.trim() || !jobTitle.trim()}
                    className="bg-pink-500 text-white px-8 py-4 rounded-xl hover:bg-pink-600 transition-colors font-semibold text-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-3 mx-auto"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        AI 면접 질문 생성 중...
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-6 h-6" />
                        {companyAnalysis 
                          ? `${companyName} 맞춤형 AI 면접 질문 생성하기` 
                          : 'AI 면접 질문 생성하기'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 2단계: 생성된 질문 목록 */}
            {currentStep === 'questions' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <Lightbulb className="w-6 h-6" />
                      생성된 면접 질문 ({questions.length}개)
                    </h2>
                    <div className="flex gap-3">
                      <button
                        onClick={startPractice}
                        className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition-colors font-medium flex items-center gap-2"
                      >
                        <Play className="w-5 h-5" />
                        연습 모드 시작
                      </button>
                      <button
                        onClick={downloadAnswers}
                        className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <div key={question.id} className="border border-gray-200 rounded-xl p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm font-medium">
                              Q{index + 1}
                            </span>
                            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                              {question.category}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                              question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {question.difficulty === 'easy' ? '쉬움' : 
                               question.difficulty === 'medium' ? '보통' : '어려움'}
                            </span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(question.question)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <Copy className="w-5 h-5" />
                          </button>
                        </div>

                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          {question.question}
                        </h3>

                        {/* 답변 팁 */}
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                          <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                            <Star className="w-4 h-4" />
                            답변 팁
                          </h4>
                          <ul className="list-disc list-inside space-y-1">
                            {question.tips.map((tip, tipIndex) => (
                              <li key={tipIndex} className="text-sm text-blue-800">{tip}</li>
                            ))}
                          </ul>
                        </div>

                        {/* 답변 작성 영역 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            나의 답변
                          </label>
                          <textarea
                            value={question.answer || ''}
                            onChange={(e) => saveAnswer(question.id, e.target.value)}
                            placeholder="답변을 작성해보세요..."
                            rows={4}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-800 text-black mb-3"
                          />
                          
                          {/* 평가 버튼 */}
                          {question.answer && question.answer.trim().length >= 10 && (
                            <div className="flex items-center gap-2 mb-4">
                              <button
                                onClick={() => evaluateAnswer(question.id)}
                                disabled={question.evaluating}
                                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                {question.evaluating ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    평가 중...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                    AI 평가 받기
                                  </>
                                )}
                              </button>
                              {question.evaluation && (
                                <span className="text-lg font-bold text-blue-600">
                                  점수: {question.evaluation.totalScore}/10
                                </span>
                              )}
                            </div>
                          )}

                          {/* 평가 결과 */}
                          {question.evaluation && (
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                              <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                                <Star className="w-5 h-5" />
                                AI 평가 결과
                              </h4>
                              
                              {/* 점수 차트 */}
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                                {Object.entries(question.evaluation.scores).map(([key, score]) => {
                                  const labels = {
                                    clarity: '명확성',
                                    specificity: '구체성',
                                    relevance: '관련성',
                                    structure: '구조화',
                                    impact: '전달력'
                                  };
                                  return (
                                    <div key={key} className="text-center">
                                      <div className="text-2xl font-bold text-blue-600">{score}</div>
                                      <div className="text-sm text-blue-700">{labels[key as keyof typeof labels]}</div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* 강점 */}
                                <div>
                                  <h5 className="font-medium text-green-900 mb-2 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    강점
                                  </h5>
                                  <ul className="list-disc list-inside space-y-1">
                                    {question.evaluation.strengths.map((strength, idx) => (
                                      <li key={idx} className="text-sm text-green-800">{strength}</li>
                                    ))}
                                  </ul>
                                </div>

                                {/* 개선점 */}
                                <div>
                                  <h5 className="font-medium text-orange-900 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    개선점
                                  </h5>
                                  <ul className="list-disc list-inside space-y-1">
                                    {question.evaluation.improvements.map((improvement, idx) => (
                                      <li key={idx} className="text-sm text-orange-800">{improvement}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              {/* 추천사항 */}
                              <div className="mt-4">
                                <h5 className="font-medium text-purple-900 mb-2 flex items-center gap-2">
                                  <Lightbulb className="w-4 h-4" />
                                  추천사항
                                </h5>
                                <ul className="list-disc list-inside space-y-1">
                                  {question.evaluation.recommendations.map((recommendation, idx) => (
                                    <li key={idx} className="text-sm text-purple-800">{recommendation}</li>
                                  ))}
                                </ul>
                              </div>

                              {/* 개선된 답변 예시 */}
                              <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
                                <h5 className="font-medium text-gray-900 mb-2">개선된 답변 예시</h5>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {question.evaluation.improvedExample}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3단계: 연습 모드 */}
            {currentStep === 'practice' && questions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <Play className="w-6 h-6" />
                    연습 모드 ({currentQuestionIndex + 1}/{questions.length})
                  </h2>
                  
                  {/* 타이머 및 음성 분석 */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg">
                      <Clock className="w-5 h-5 text-gray-800" />
                      <span className="font-mono text-lg text-gray-900 font-semibold">{formatTime(answerTime)}</span>
                    </div>
                    
                    {/* 음성 분석 컨트롤 */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                        className={`p-2 rounded-lg transition-colors ${
                          isRecording 
                            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                            : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                        }`}
                      >
                        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                      
                      {/* 음성 레벨 표시 */}
                      {isRecording && (
                        <div className="flex items-center gap-1">
                          <Volume2 className="w-4 h-4 text-gray-600" />
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500 transition-all duration-100"
                              style={{ width: `${audioLevel * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={toggleTimer}
                      className={`p-2 rounded-lg transition-colors ${
                        isTimerRunning ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'
                      }`}
                    >
                      {isTimerRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={resetTimer}
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 현재 질문 */}
                <div className="border border-gray-200 rounded-xl p-6 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-sm font-medium">
                      Q{currentQuestionIndex + 1}
                    </span>
                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                      {questions[currentQuestionIndex].category}
                    </span>
                  </div>

                  <h3 className="text-xl font-medium text-gray-900 mb-6">
                    {questions[currentQuestionIndex].question}
                  </h3>

                  {/* 답변 작성 */}
                  <textarea
                    value={questions[currentQuestionIndex].answer || ''}
                    onChange={(e) => saveAnswer(questions[currentQuestionIndex].id, e.target.value)}
                    placeholder="답변을 작성하고 연습해보세요..."
                    rows={6}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-800 text-black mb-4"
                  />

                  {/* 네비게이션 버튼 */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={prevQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      이전 질문
                    </button>

                    <div className="flex gap-2">
                      {questions.map((_, index) => (
                        <div
                          key={index}
                          className={`w-3 h-3 rounded-full ${
                            index === currentQuestionIndex ? 'bg-pink-500' : 
                            questions[index].answer ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={nextQuestion}
                      className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600 transition-colors"
                    >
                      {currentQuestionIndex === questions.length - 1 ? '완료' : '다음 질문'}
                    </button>
                  </div>
                </div>

                {/* 음성 분석 결과 */}
                {voiceAnalysis && isRecording && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-200">
                    <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      실시간 음성 분석
                    </h4>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      {/* 자신감 */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{voiceAnalysis.confidence}%</div>
                        <div className="text-sm text-blue-700">자신감</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${voiceAnalysis.confidence}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* 말하기 속도 */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{voiceAnalysis.pace}%</div>
                        <div className="text-sm text-green-700">말하기 속도</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${voiceAnalysis.pace}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* 음량 */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{voiceAnalysis.volume}%</div>
                        <div className="text-sm text-purple-700">음량</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${voiceAnalysis.volume}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* 명료도 */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{voiceAnalysis.clarity}%</div>
                        <div className="text-sm text-orange-700">명료도</div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${voiceAnalysis.clarity}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* 톤 분석 */}
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${
                          voiceAnalysis.tone === 'confident' ? 'text-emerald-600' :
                          voiceAnalysis.tone === 'calm' ? 'text-blue-600' :
                          voiceAnalysis.tone === 'excited' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {voiceAnalysis.tone === 'confident' ? '자신감' :
                           voiceAnalysis.tone === 'calm' ? '차분함' :
                           voiceAnalysis.tone === 'excited' ? '흥미로움' :
                           '긴장'}
                        </div>
                        <div className="text-sm text-gray-700">분위기</div>
                      </div>
                    </div>
                    
                    {/* 실시간 피드백 */}
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <h5 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        실시간 피드백
                      </h5>
                      <div className="text-sm text-gray-700">
                        {voiceAnalysis.confidence > 70 && voiceAnalysis.volume > 40 && voiceAnalysis.clarity > 60 ? (
                          <span className="text-green-700">✨ 훌륭합니다! 자신감 있고 명확한 말투를 유지하고 있습니다.</span>
                        ) : voiceAnalysis.volume < 30 ? (
                          <span className="text-orange-700">🔊 목소리를 조금 더 크게 내보세요.</span>
                        ) : voiceAnalysis.pace < 30 ? (
                          <span className="text-blue-700">⏩ 조금 더 적극적으로 답변해보세요.</span>
                        ) : voiceAnalysis.confidence < 50 ? (
                          <span className="text-purple-700">💪 심호흡을 하고 자신감을 가져보세요.</span>
                        ) : (
                          <span className="text-gray-700">👍 좋은 페이스로 답변하고 있습니다.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* AI 음성 평가 */}
                {recordedAudio && !isRecording && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 mb-6 border border-purple-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                        <Mic className="w-5 h-5" />
                        AI 음성 평가
                      </h4>
                      <button
                        onClick={evaluateVoiceWithAI}
                        disabled={isEvaluatingVoice}
                        className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isEvaluatingVoice ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            분석 중...
                          </>
                        ) : (
                          <>
                            <Star className="w-4 h-4" />
                            AI 평가받기
                          </>
                        )}
                      </button>
                    </div>

                    {!voiceEvaluation && !isEvaluatingVoice && (
                      <p className="text-purple-700 text-sm">
                        🎤 녹음이 완료되었습니다. AI 평가받기 버튼을 눌러서 음성 톤, 말하기 속도, 명료도 등을 종합적으로 분석받아보세요.
                      </p>
                    )}

                    {/* AI 평가 결과 */}
                    {voiceEvaluation && (
                      <div className="space-y-4">
                        {/* 종합 점수 */}
                        <div className="text-center bg-white rounded-lg p-4 border border-purple-200">
                          <div className="text-3xl font-bold text-purple-600 mb-2">
                            {voiceEvaluation.overallScore}/10
                          </div>
                          <div className="text-lg text-purple-800">종합 음성 점수</div>
                        </div>

                        {/* 세부 평가 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <h5 className="font-medium text-purple-900 mb-3">📊 세부 평가</h5>
                            <div className="space-y-2 text-sm">
                              <div><span className="font-medium">음성 톤:</span> <span className="text-purple-700">{voiceEvaluation.tone}</span></div>
                              <div><span className="font-medium">말하기 속도:</span> <span className="text-purple-700">{voiceEvaluation.pace}</span></div>
                              <div><span className="font-medium">음량:</span> <span className="text-purple-700">{voiceEvaluation.volume}</span></div>
                              <div><span className="font-medium">명료도:</span> <span className="text-purple-700">{voiceEvaluation.clarity}</span></div>
                              <div><span className="font-medium">자신감:</span> <span className="text-purple-700">{voiceEvaluation.confidence}</span></div>
                            </div>
                          </div>

                          <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <h5 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              강점
                            </h5>
                            <ul className="list-disc list-inside space-y-1 text-sm text-green-800">
                              {voiceEvaluation.strengths.map((strength, idx) => (
                                <li key={idx}>{strength}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <h5 className="font-medium text-orange-900 mb-3 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              개선점
                            </h5>
                            <ul className="list-disc list-inside space-y-1 text-sm text-orange-800">
                              {voiceEvaluation.improvements.map((improvement, idx) => (
                                <li key={idx}>{improvement}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <h5 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                              <Lightbulb className="w-4 h-4" />
                              추천사항
                            </h5>
                            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
                              {voiceEvaluation.recommendations.map((recommendation, idx) => (
                                <li key={idx}>{recommendation}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 답변 팁 */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    답변 팁
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {questions[currentQuestionIndex].tips.map((tip, tipIndex) => (
                      <li key={tipIndex} className="text-sm text-blue-800">{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* 4단계: 피드백 및 완료 */}
            {currentStep === 'feedback' && (
              <div className="space-y-6">
                {/* 전체 평가 요약 */}
                {(() => {
                  const evaluatedQuestions = questions.filter(q => q.evaluation);
                  const totalAverage = evaluatedQuestions.length > 0 
                    ? evaluatedQuestions.reduce((sum, q) => sum + (q.evaluation?.totalScore || 0), 0) / evaluatedQuestions.length 
                    : 0;
                  
                  return evaluatedQuestions.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-lg p-8">
                      <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                        <Star className="w-6 h-6" />
                        전체 평가 요약
                      </h3>
                      
                      <div className="text-center mb-6">
                        <div className="text-4xl font-bold text-blue-600 mb-2">
                          {totalAverage.toFixed(1)}/10
                        </div>
                        <div className="text-lg text-gray-900">
                          전체 평균 점수
                        </div>
                        <div className="text-sm text-gray-800 mt-1">
                          {evaluatedQuestions.length}개 질문 평가 완료
                        </div>
                      </div>

                      {/* 카테고리별 점수 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from(new Set(evaluatedQuestions.map(q => q.category))).map(category => {
                          const categoryQuestions = evaluatedQuestions.filter(q => q.category === category);
                          const categoryAverage = categoryQuestions.reduce((sum, q) => sum + (q.evaluation?.totalScore || 0), 0) / categoryQuestions.length;
                          
                          return (
                            <div key={category} className="bg-gray-50 rounded-lg p-4 text-center">
                              <div className="text-2xl font-bold text-gray-800">{categoryAverage.toFixed(1)}</div>
                              <div className="text-sm text-gray-800">{category}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                  <div className="bg-green-100 p-4 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">면접 준비 완료!</h2>
                  <p className="text-gray-800 mb-6">
                    총 {questions.length}개의 질문에 대한 답변을 준비했습니다.
                  </p>

                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={downloadAnswers}
                      className="bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600 transition-colors font-medium flex items-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      답변 다운로드
                    </button>
                    <button
                      onClick={restartInterview}
                      className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                    >
                      새로 시작하기
                    </button>
                  </div>
                </div>

                {/* 답변 요약 */}
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">답변 요약</h3>
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <div key={question.id} className="border-l-4 border-pink-500 pl-4">
                        <h4 className="font-medium text-gray-900 mb-2">
                          Q{index + 1}. {question.question}
                        </h4>
                        <p className="text-gray-900 text-sm">
                          {question.answer ? 
                            (question.answer.length > 100 ? 
                              `${question.answer.substring(0, 100)}...` : 
                              question.answer
                            ) : 
                            '답변이 작성되지 않았습니다.'
                          }
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 