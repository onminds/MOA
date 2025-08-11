"use client";
import { useState, useRef, useEffect } from "react";
import Header from '../../components/Header';

// CSS 애니메이션 스타일
const audioGaugeStyles = `
  @keyframes audioWave {
    0%, 100% { transform: scaleY(0.3); }
    50% { transform: scaleY(1); }
  }
  
  .audio-wave {
    animation: audioWave 0.5s ease-in-out infinite;
  }
  
  .audio-gauge {
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .audio-gauge-smooth {
    transition: width 0.2s ease-out;
  }
`;
import {
  ArrowLeft, Briefcase, Building2, User, Clock, Lightbulb, CheckCircle, 
  Play, Pause, RotateCcw, Download, Copy, FileText, Loader2, AlertCircle, Star,
  Mic, MicOff, Volume2, TrendingUp, BarChart3, Globe, Target, Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  
  // CSS 스타일 적용
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = audioGaugeStyles;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
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
    originalCompanyName?: string;
  } | null>(null);
  
  // 입력 정보
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [experience, setExperience] = useState('');
  const [skills, setSkills] = useState('');
  const [careerLevel, setCareerLevel] = useState('junior'); // junior, mid, senior
  const [manualInputMode, setManualInputMode] = useState(false);
  
  // 면접 질문 및 답변
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [practiceMode, setPracticeMode] = useState(false);
  const [answerTime, setAnswerTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // 로딩 진행률 상태
  const [loadingProgress, setLoadingProgress] = useState({
    companyAnalysis: false,
    questionGeneration: false,
    difficultyClassification: false,
    tipsGeneration: false
  });
  
  // 음성 분석 상태
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [smoothAudioLevel, setSmoothAudioLevel] = useState(0); // 부드러운 애니메이션용
  const [voiceAnalysis, setVoiceAnalysis] = useState<{
    confidence: number;
    pace: number;
    volume: number;
    tone: 'calm' | 'nervous' | 'confident' | 'excited';
    clarity: number;
    volumeLevel: number;
  } | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [isEvaluatingVoice, setIsEvaluatingVoice] = useState(false);
  const [voiceEvaluation, setVoiceEvaluation] = useState<{
    overallScore: number;
    tone: string;
    pace: string;
    volume: string;
    clarity: string;
    confidence: string;
    expressiveness: string;
    structure: string;
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    detailedAnalysis: string;
  } | null>(null);
  
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
        const errorMessage = errorData.error || '회사 분석에 실패했습니다.';
        const statusCode = response.status;
        
        // 상태 코드에 따른 오류 메시지 개선
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
      
      if (data.success) {
        setCompanyAnalysis({
          ...data.companyAnalysis,
          originalCompanyName: companyName.trim()
        });
      } else {
        throw new Error(data.error || '회사 분석 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('회사 분석 오류:', error);
      setError(error instanceof Error ? error.message : '회사 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzingCompany(false);
    }
  };

  // 로딩 진행률 시뮬레이션
  const simulateLoadingProgress = () => {
    // 회사 분석이 완료되지 않은 경우에만 시뮬레이션
    if (!companyAnalysis) {
      setTimeout(() => {
        setLoadingProgress(prev => ({ ...prev, companyAnalysis: true }));
      }, 500);
    }
    
    // 질문 생성 시작 (1초 후)
    setTimeout(() => {
      setLoadingProgress(prev => ({ ...prev, questionGeneration: true }));
    }, 1000);
    
    // 난이도 분류 시작 (3초 후)
    setTimeout(() => {
      setLoadingProgress(prev => ({ ...prev, difficultyClassification: true }));
    }, 3000);
    
    // 팁 생성 시작 (5초 후)
    setTimeout(() => {
      setLoadingProgress(prev => ({ ...prev, tipsGeneration: true }));
    }, 5000);
  };

  // 면접 질문 생성
  const generateQuestions = async () => {
    // 입력 유효성 검사
    if (manualInputMode) {
      if (!companyName.trim() || !jobTitle.trim()) {
        setError('회사명과 직무를 모두 입력해주세요.');
        return;
      }
    } else {
      if (!companyAnalysis) {
        setError('먼저 회사 분석을 진행해주세요.');
        return;
      }
    }

    setLoading(true);
    setError(null);
    
    // 로딩 진행률 초기화 및 시뮬레이션 시작
    setLoadingProgress({
      companyAnalysis: !!companyAnalysis, // 회사 분석이 완료된 경우 true
      questionGeneration: false,
      difficultyClassification: false,
      tipsGeneration: false
    });
    simulateLoadingProgress();

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
      // 로딩 완료 시 진행률 초기화
      setLoadingProgress({
        companyAnalysis: false,
        questionGeneration: false,
        difficultyClassification: false,
        tipsGeneration: false
      });
    }
  };

  // 답변 검증 함수
  const validateAnswer = (answer: string): { isValid: boolean; message: string } => {
    const trimmedAnswer = answer.trim();
    
    // 최소 길이 검증
    if (trimmedAnswer.length < 50) {
      return { 
        isValid: false, 
        message: '답변이 너무 짧습니다. 최소 50자 이상 작성해주세요.' 
      };
    }
    
    // 의미없는 반복 검증
    const words = trimmedAnswer.split(/\s+/);
    const uniqueWords = new Set(words);
    if (uniqueWords.size < words.length * 0.3) {
      return { 
        isValid: false, 
        message: '같은 단어가 너무 많이 반복됩니다. 더 다양한 표현을 사용해주세요.' 
      };
    }
    
    // 질문과 관련없는 내용 검증 (간단한 키워드 매칭)
    const question = questions.find(q => q.id === currentQuestionIndex)?.question || '';
    const questionKeywords = question.match(/[가-힣a-zA-Z]+/g) || [];
    const answerKeywords = trimmedAnswer.match(/[가-힣a-zA-Z]+/g) || [];
    
    const relevantKeywords = questionKeywords.filter(keyword => 
      answerKeywords.some(answerKeyword => 
        answerKeyword.includes(keyword) || keyword.includes(answerKeyword)
      )
    );
    
    if (relevantKeywords.length < questionKeywords.length * 0.2) {
      return { 
        isValid: false, 
        message: '질문과 관련없는 내용입니다. 질문에 맞는 답변을 작성해주세요.' 
      };
    }
    
    return { isValid: true, message: '' };
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
    if (!question || !question.answer) {
      setError('답변을 작성해주세요.');
      return;
    }

    // 답변 검증
    const validation = validateAnswer(question.answer);
    if (!validation.isValid) {
      setError(validation.message);
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
    if (isRecording) {
      stopVoiceRecording(); // 기존 녹음이 있다면 정지
    }
    setPracticeMode(true);
    setCurrentQuestionIndex(0);
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
      if (isRecording) {
        stopVoiceRecording(); // 녹음 중이면 정지
      }
      setCurrentStep('feedback');
      setPracticeMode(false);
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
    if (isRecording) {
      stopVoiceRecording(); // 녹음 중이면 정지
    }
    setCurrentStep('input');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setPracticeMode(false);
    resetTimer();
    setCompanyName('');
    setJobTitle('');
    setJobDescription('');
    setExperience('');
    setSkills('');
    setError(null);
    // 회사 분석 결과는 유지 (회사명을 지워도 분석 결과가 사라지지 않도록)
  };

  // 텍스트 복사
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: 토스트 알림 추가
  };

  // 음성 녹음 시작
  const startVoiceRecording = async () => {
    try {
      // 먼저 브라우저 지원 여부 확인
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 마이크 접근을 지원하지 않습니다.');
      }

      // 권한 상태 확인 (선택적)
      if (navigator.permissions) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log('마이크 권한 상태:', permissionStatus.state);
          
          // 권한이 거부된 경우에도 getUserMedia를 시도해보기 위해 주석 처리
          // if (permissionStatus.state === 'denied') {
          //   throw new Error('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.');
          // }
        } catch (permissionError) {
          console.log('권한 확인 중 오류 (무시하고 진행):', permissionError);
        }
      }

      console.log('🎙️ 마이크 접근 시도 중...');
      console.log('브라우저 정보:', {
        userAgent: navigator.userAgent,
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!navigator.mediaDevices?.getUserMedia,
        permissions: !!navigator.permissions,
        isSecureContext: window.isSecureContext,
        location: window.location.href
      });
      
      // 마이크 접근 시도 (더 안전한 방법)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (firstError) {
        console.log('첫 번째 시도 실패, 기본 설정으로 재시도:', firstError);
        // 첫 번째 시도가 실패하면 더 간단한 설정으로 재시도
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true
        });
      }
      
      console.log('✅ 마이크 접근 성공:', stream.getTracks().map(track => track.label));
      
      streamRef.current = stream;
      
      // AudioContext 설정 - 더 민감한 감지를 위해 조정
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      // 더 민감한 설정으로 변경
      analyserRef.current.fftSize = 512; // 더 정확한 분석을 위해 증가
      analyserRef.current.smoothingTimeConstant = 0.3; // 더 빠른 반응
      analyserRef.current.minDecibels = -60; // 더 높은 임계값 (기존 -90)
      analyserRef.current.maxDecibels = -10;
      
      source.connect(analyserRef.current);
      
      console.log('AudioContext 설정 완료:', {
        fftSize: analyserRef.current.fftSize,
        frequencyBinCount: analyserRef.current.frequencyBinCount,
        smoothingTimeConstant: analyserRef.current.smoothingTimeConstant,
        minDecibels: analyserRef.current.minDecibels,
        maxDecibels: analyserRef.current.maxDecibels
      });
      
      // MediaRecorder 설정 - 녹음 데이터 수집
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
        
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: mimeType
      });
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        setRecordedAudio(audioBlob);
      };
      
      mediaRecorderRef.current.start();
      
      // 상태 설정을 더 명확하게
      setIsRecording(true);
      setRecordedAudio(null);
      setVoiceEvaluation(null);
      setAudioLevel(0); // 초기화
      setSmoothAudioLevel(0); // 부드러운 값도 초기화
      setVoiceAnalysis(null); // 음성 분석 초기화
      setError(null); // 오류 초기화
      
      console.log('🎙️ 녹음 시작됨, 상태 확인:', {
        audioContext: !!audioContextRef.current,
        analyser: !!analyserRef.current,
        stream: !!streamRef.current,
        mediaRecorder: !!mediaRecorderRef.current,
        isRecording: true // 강제로 true로 설정
      });
      
      // 상태 업데이트 후 약간의 지연을 두고 모니터링 시작
      setTimeout(() => {
        console.log('🎙️ 음성 모니터링 시작...');
      startAudioLevelMonitoring();
      }, 100); // 100ms 지연
      
    } catch (error) {
      console.error('마이크 접근 오류:', error);
      
      // 더 구체적인 오류 메시지 제공
      let errorMessage = '마이크에 접근할 수 없습니다.';
      
      if (error instanceof Error) {
        console.log('오류 상세 정보:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        if (error.name === 'NotAllowedError' || error.message.includes('permission')) {
          errorMessage = '마이크 권한이 거부되었습니다. 브라우저 주소창의 자물쇠 아이콘을 클릭하여 마이크 권한을 허용해주세요.';
        } else if (error.name === 'NotFoundError' || error.message.includes('device')) {
          errorMessage = '마이크 장치를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.';
        } else if (error.name === 'NotSupportedError' || error.message.includes('support')) {
          errorMessage = '이 브라우저는 마이크 접근을 지원하지 않습니다. Chrome, Firefox, Safari를 사용해주세요.';
        } else if (error.message.includes('HTTPS')) {
          errorMessage = '마이크 접근은 HTTPS 환경에서만 가능합니다.';
        } else if (error.message.includes('getUserMedia')) {
          errorMessage = '마이크 접근에 실패했습니다. 브라우저를 새로고침하고 다시 시도해주세요.';
        } else {
          errorMessage = `마이크 접근 오류: ${error.message}`;
        }
      }
      
      setError(errorMessage);
    }
  };

  // 음성 녹음 정지
  const stopVoiceRecording = () => {
    console.log('🛑 녹음 정지 시작, 현재 상태:', {
      isRecording,
      hasMediaRecorder: !!mediaRecorderRef.current,
      hasStream: !!streamRef.current,
      hasAudioContext: !!audioContextRef.current
    });
    
    // MediaRecorder 정지
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          console.log('🛑 MediaRecorder 정지');
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.error('MediaRecorder 정지 중 오류:', error);
      }
    }
    
    // Stream 트랙 정지
    if (streamRef.current) {
      try {
        console.log('🛑 Stream 트랙 정지');
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log('🛑 트랙 정지됨:', track.kind, track.label);
        });
      } catch (error) {
        console.error('Stream 정지 중 오류:', error);
      }
    }
    
    // AudioContext 정지
    if (audioContextRef.current) {
      try {
        console.log('🛑 AudioContext 정지');
        audioContextRef.current.close();
      } catch (error) {
        console.error('AudioContext 정지 중 오류:', error);
      }
    }
    
    // 참조 정리
    mediaRecorderRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    
    console.log('🛑 상태 초기화');
    setIsRecording(false);
    setAudioLevel(0);
    setSmoothAudioLevel(0); // 부드러운 값도 초기화
  };

  // 실시간 음성 레벨 모니터링
  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current) {
      console.error('❌ AnalyserNode가 없습니다.');
      return;
    }
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    console.log('🎵 음성 모니터링 시작, dataArray 길이:', dataArray.length);
    
    const updateLevel = () => {
      // 상태 체크를 더 자세히
      if (!analyserRef.current) {
        console.log('❌ AnalyserNode가 없음 - 모니터링 중단');
        return;
      }
      
      // MediaRecorder 상태를 우선적으로 확인
      const isActuallyRecording = mediaRecorderRef.current && 
        mediaRecorderRef.current.state === 'recording';
      
      if (!isActuallyRecording) {
        console.log('❌ MediaRecorder가 녹음 중이 아님 - 모니터링 중단:', {
          isRecording,
          mediaRecorderState: mediaRecorderRef.current?.state,
          hasMediaRecorder: !!mediaRecorderRef.current
        });
        return;
      }
      
      try {
      analyserRef.current.getByteFrequencyData(dataArray);
      
        // 더 민감한 음성 레벨 계산
        let sum = 0;
        let count = 0;
        let maxValue = 0;
        
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > 0) {
            sum += dataArray[i];
            count++;
            maxValue = Math.max(maxValue, dataArray[i]);
          }
        }
        
        // 평균과 최대값을 모두 고려한 계산
        const average = count > 0 ? sum / count : 0;
        const normalizedLevel = Math.min((average + maxValue * 0.3) / 128, 1); // 최대값도 고려
        const percentage = Math.round(normalizedLevel * 100);
        
        // 부드러운 애니메이션을 위한 평균 계산
        const smoothingFactor = 0.7; // 부드러움 정도 (0.1-0.9)
        const newSmoothLevel = smoothAudioLevel * smoothingFactor + normalizedLevel * (1 - smoothingFactor);
        
        // 디버깅을 위한 로그 (더 자주 출력)
        if (Math.random() < 0.3) { // 30% 확률로 로그 출력 (기존 10%에서 증가)
          console.log('🎤 음성 감지:', {
            average: Math.round(average),
            maxValue: Math.round(maxValue),
            normalizedLevel: Math.round(normalizedLevel * 100) / 100,
            smoothLevel: Math.round(newSmoothLevel * 100) / 100,
            percentage,
            dataArrayLength: dataArray.length,
            nonZeroCount: count,
            isRecording,
            mediaRecorderState: mediaRecorderRef.current?.state,
            hasAudioContext: !!audioContextRef.current,
            hasAnalyser: !!analyserRef.current
          });
        }
        
        // 상태 업데이트 - 부드러운 값 사용
      setAudioLevel(normalizedLevel);
        setSmoothAudioLevel(newSmoothLevel);
        
        // voiceAnalysis도 부드러운 값으로 업데이트
        setVoiceAnalysis(prev => ({
          confidence: Math.round(50 + (newSmoothLevel * 50)),
          pace: Math.round(50 + (newSmoothLevel * 50)),
          volume: Math.round(newSmoothLevel * 100),
          tone: newSmoothLevel > 0.7 ? 'excited' : newSmoothLevel > 0.5 ? 'confident' : newSmoothLevel > 0.3 ? 'calm' : 'nervous',
          clarity: Math.round(50 + (newSmoothLevel * 50)),
          volumeLevel: Math.round(newSmoothLevel * 100)
        }));
        
        // 다음 프레임 요청 - MediaRecorder 상태 확인
        if (isActuallyRecording) {
        requestAnimationFrame(updateLevel);
        } else {
          console.log('⏹️ MediaRecorder가 중단되어 모니터링 중단');
        }
    } catch (error) {
        console.error('음성 레벨 업데이트 오류:', error);
      }
    };
    
    // 즉시 시작
    updateLevel();
  };

  // 음성 분석 수행
  const performVoiceAnalysis = (frequencyData: Uint8Array, volume: number) => {
    if (!frequencyData || frequencyData.length === 0) return;
    
    // 실시간 볼륨 레벨 계산 (게이지 바용) - 더 간단한 방법
    let sum = 0;
    let count = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > 0) {
        sum += frequencyData[i];
        count++;
      }
    }
    
    const averageVolume = count > 0 ? sum / count : 0;
    const volumeLevel = Math.min((averageVolume / 128) * 100, 100);
    
    // 기본 음성 특성 분석
    const highFreq = frequencyData.slice(Math.floor(frequencyData.length * 0.7)).reduce((sum, val) => sum + val, 0);
    const midFreq = frequencyData.slice(Math.floor(frequencyData.length * 0.3), Math.floor(frequencyData.length * 0.7)).reduce((sum, val) => sum + val, 0);
    const lowFreq = frequencyData.slice(0, Math.floor(frequencyData.length * 0.3)).reduce((sum, val) => sum + val, 0);
    
    const totalEnergy = highFreq + midFreq + lowFreq;
    
    // 기본값 설정 (소리가 없을 때도 기본값 제공)
    let confidence = 50;
    let pace = 50;
    let clarity = 50;
    let tone: 'calm' | 'nervous' | 'confident' | 'excited' = 'calm';
    
    if (totalEnergy > 0) {
      // 신뢰도 계산 (음성의 안정성)
      confidence = Math.min((midFreq / totalEnergy) * 100, 100);
      
      // 말하기 속도 (고주파 대비)
      pace = Math.min((highFreq / totalEnergy) * 100, 100);
      
      // 명료도 (전체적인 에너지 분포)
      clarity = Math.min(((highFreq + midFreq) / totalEnergy) * 100, 100);
      
      // 톤 분석
      if (volume > 0.7 && pace > 60) {
        tone = 'excited';
      } else if (volume > 0.5 && confidence > 60) {
        tone = 'confident';
      } else if (volume < 0.3 || pace < 30) {
        tone = 'nervous';
      } else {
        tone = 'calm';
      }
      }
      
    // 항상 업데이트 (소리가 없어도)
      setVoiceAnalysis({
        confidence: Math.round(confidence),
        pace: Math.round(pace),
        volume: Math.round(volume * 100),
        tone,
      clarity: Math.round(clarity),
      volumeLevel: Math.round(volumeLevel)
      });
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
      const errorMessage = error instanceof Error ? error.message : '음성 평가 중 오류가 발생했습니다.';
      
      // 특정 오류 메시지에 대한 사용자 친화적 안내
      if (errorMessage.includes('다시 녹음해주세요')) {
        setError('음성 내용이 부적절하거나 의미없는 내용입니다. 다시 녹음해주세요.');
      } else if (errorMessage.includes('음성을 인식할 수 없습니다')) {
        setError('음성을 인식할 수 없습니다. 더 명확하게 말씀해주세요.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsEvaluatingVoice(false);
    }
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 컴포넌트가 언마운트될 때만 정리
      if (isRecording) {
        console.log('🔄 컴포넌트 언마운트 - 녹음 정리');
      stopVoiceRecording();
      }
    };
  }, []); // 빈 의존성 배열로 컴포넌트 언마운트 시에만 실행

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-8">
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
                <div className="bg-pink-500 p-3 rounded-xl">
                  <Briefcase className="w-8 h-8 text-white" />
                </div>
                <div>
            <h1 className="text-3xl font-bold text-gray-900">면접 준비</h1>
                  <p className="text-gray-800 mt-1">AI가 생성한 맞춤형 면접 질문으로 완벽하게 준비하세요</p>
                </div>
          </div>

                            {/* 진행 단계 표시 */}
              <div className="w-full flex items-center justify-between bg-white rounded-xl p-4 shadow-sm">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              currentStep === 'input' ? 'bg-pink-100 text-pink-700' : 
              ['questions', 'practice', 'feedback'].includes(currentStep) ? 'bg-green-100 text-green-700' : 
              'bg-gray-100 text-gray-500'
            }`}>
              <User className="w-4 h-4" />
                  정보 입력
            </div>
                <div className="flex-grow h-0.5 bg-gray-200 mx-2"></div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                currentStep === 'questions' ? 'bg-pink-100 text-pink-700' : 
                ['practice', 'feedback'].includes(currentStep) ? 'bg-green-100 text-green-700' : 
                'bg-gray-100 text-gray-500'
              }`}>
                {['practice', 'feedback'].includes(currentStep) ? <Check className="w-4 h-4" /> : <Lightbulb className="w-4 h-4" />}
                질문 답변
              </div>
              <div className="flex-grow h-0.5 bg-gray-200 mx-2"></div>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              currentStep === 'practice' ? 'bg-pink-100 text-pink-700' : 
              currentStep === 'feedback' ? 'bg-green-100 text-green-700' : 
              'bg-gray-100 text-gray-500'
            }`}>
                  <Play className="w-4 h-4" />
                  연습 모드
            </div>
                <div className="flex-grow h-0.5 bg-gray-200 mx-2"></div>
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
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700 font-medium">오류가 발생했습니다</span>
              </div>
              <p className="text-red-700 text-sm">{error}</p>
              <div className="mt-3 p-3 bg-red-100 rounded-lg">
                <p className="text-red-800 text-xs">
                  💡 해결 방법:
                </p>
                <ul className="text-red-700 text-xs mt-1 space-y-1">
                  {error.includes('마이크') || error.includes('권한') ? (
                    <>
                      <li>• 브라우저 주소창 왼쪽의 자물쇠 아이콘을 클릭하여 마이크 권한을 허용해주세요</li>
                      <li>• 브라우저 설정에서 사이트 권한 → 마이크 → 허용으로 설정해주세요</li>
                      <li>• Chrome, Firefox, Safari 등 최신 브라우저를 사용해주세요</li>
                      <li>• 마이크가 연결되어 있고 정상 작동하는지 확인해주세요</li>
                      <li>• 페이지를 새로고침한 후 다시 시도해주세요</li>
                    </>
                  ) : (
                    <>
                      <li>• 잠시 후 다시 시도해주세요</li>
                      <li>• 회사명을 정확히 입력했는지 확인해주세요</li>
                      <li>• 인터넷 연결 상태를 확인해주세요</li>
                      <li>• 문제가 지속되면 다른 회사명으로 시도해보세요</li>
                    </>
                  )}
                </ul>
              </div>
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
                <div className="md:col-span-1">
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
                  <p className="text-xs text-gray-500 mt-2">💡 정확한 회사명을 작성하지 않으면 확실하지 않은 정보가 나올 수 있습니다.</p>
                </div>

                {/* 직무명 */}
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    지원 직무 *
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="예: 사무직, 영업직, 마케팅, 인사, 회계, 고객서비스"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-500 text-black"
                  />
                </div>
                
                {/* 회사 분석 버튼 - 그리드 안으로 이동 */}
                <div className="md:col-span-2 flex items-center gap-4">
                  <button
                    onClick={analyzeCompany}
                    disabled={isAnalyzingCompany || !companyName.trim()}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isAnalyzingCompany ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        분석 중...
                      </>
                    ) : (
                      <>
                        <Globe className="w-5 h-5" />
                        {companyAnalysis && !manualInputMode ? '재분석' : 'AI 분석'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setManualInputMode(prev => {
                        const nextMode = !prev;
                        if (nextMode && !companyAnalysis) {
                          setCompanyAnalysis({
                            coreValues: [],
                            idealCandidate: '',
                            vision: '',
                            businessAreas: [],
                            companyCulture: '',
                            keyCompetencies: [],
                            originalCompanyName: companyName,
                          });
                        }
                        return nextMode;
                      });
                    }}
                    className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center gap-2"
                  >
                    <FileText className="w-5 h-5" />
                    {manualInputMode ? '입력 창 닫기' : '직접 입력'}
                  </button>
                </div>
              </div>

                {/* --- 회사 정보 표시 영역 --- */}

                {/* Case 1: AI 분석 결과 표시 */}
                {companyAnalysis && !manualInputMode && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6 border border-blue-200">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      {`${companyAnalysis.originalCompanyName || companyName || '분석된 회사'} 분석 결과`}
                    </h3>
                    
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-lg mb-4">
                      <div className="flex">
                        <div className="py-1"><AlertCircle className="h-5 w-5 text-yellow-500 mr-3" /></div>
                        <div>
                          <p className="font-bold">주의</p>
                          <p className="text-sm">이 정보는 AI로 분석한 것이며, 중요한 내용은 공식 홈페이지 등에서 재차 확인해주세요.</p>
                        </div>
                      </div>
                    </div>

                    {/* 분석 내용 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* 핵심가치, 인재상 등 기존 UI */}
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

                    {/* 편집 버튼 */}
                    <div className="flex justify-end mt-4">
                      <button 
                        onClick={() => setManualInputMode(true)}
                        className="text-sm text-gray-600 underline hover:text-blue-600 transition-colors"
                      >
                        편집하기
                      </button>
                    </div>
                  </div>
                )}

                {/* Case 2: 직접 입력 폼 표시 */}
                {companyAnalysis && manualInputMode && (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-6 mb-6 border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {`${companyName || '회사'} 정보 직접 입력`}
                    </h3>
                    <div className="space-y-4">
                      {/* 핵심가치, 인재상 등 기존 폼 */}
                       <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">🎯 핵심가치</label>
                          <input
                            type="text"
                            placeholder="쉼표(,)로 구분하여 입력 (예: 도전, 성장, 협업)"
                            value={companyAnalysis.coreValues.join(', ')}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, coreValues: e.target.value.split(',').map(s => s.trim()) })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">👤 인재상</label>
                          <textarea
                            placeholder="회사가 원하는 인재상에 대해 설명해주세요."
                            value={companyAnalysis.idealCandidate}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, idealCandidate: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black"
                            rows={2}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">🌟 비전/미션</label>
                          <input
                            type="text"
                            placeholder="회사의 비전이나 미션을 입력해주세요."
                            value={companyAnalysis.vision}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, vision: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black"
                          />
                        </div>
                         <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">🏢 회사 문화</label>
                          <input
                            type="text"
                            placeholder="회사의 전반적인 문화나 분위기를 설명해주세요."
                            value={companyAnalysis.companyCulture}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, companyCulture: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">💼 주요 사업분야</label>
                           <input
                            type="text"
                            placeholder="쉼표(,)로 구분하여 입력 (예: AI, 클라우드, 자율주행)"
                            value={companyAnalysis.businessAreas.join(', ')}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, businessAreas: e.target.value.split(',').map(s => s.trim()) })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">💪 중요 역량</label>
                          <input
                            type="text"
                            placeholder="쉼표(,)로 구분하여 입력 (예: 문제해결능력, 소통능력)"
                            value={companyAnalysis.keyCompetencies.join(', ')}
                            onChange={(e) => setCompanyAnalysis({ ...companyAnalysis, keyCompetencies: e.target.value.split(',').map(s => s.trim()) })}
                            className="w-full p-2 border border-gray-300 rounded-md text-black"
                          />
                        </div>
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
                    placeholder="예: Excel, PowerPoint, 커뮤니케이션, 문제해결, 팀워크, 리더십"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-500 text-black"
                  />
                  <p className="text-sm text-gray-800 mt-1">쉼표(,)로 구분해서 입력해주세요</p>
              </div>

                {/* 질문 생성 버튼 */}
                <div className="text-center">
                <button
                  onClick={generateQuestions}
                    disabled={
                      loading ||
                      (!manualInputMode && !companyAnalysis) ||
                      (manualInputMode && (!companyName.trim() || !jobTitle.trim()))
                    }
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
                  
                  {/* 로딩 게이지 바 */}
                  {loading && (
                    <div className="mt-6 max-w-md mx-auto">
                      <div className="bg-gray-200 rounded-full h-4 overflow-hidden relative">
                        <div 
                          className="bg-gradient-to-r from-pink-500 via-pink-400 to-pink-600 h-4 rounded-full transition-all duration-500 ease-out"
                          style={{ 
                            width: `${(() => {
                              let progress = 0;
                              let completedSteps = 0;
                              let totalSteps = 0;
                              
                              if (loadingProgress.companyAnalysis) {
                                progress += 25;
                                completedSteps++;
                                totalSteps++;
                              }
                              if (loadingProgress.questionGeneration) {
                                progress += 40;
                                completedSteps++;
                                totalSteps++;
                              }
                              if (loadingProgress.difficultyClassification) {
                                progress += 20;
                                completedSteps++;
                                totalSteps++;
                              }
                              if (loadingProgress.tipsGeneration) {
                                progress += 15;
                                completedSteps++;
                                totalSteps++;
                              }
                              
                              // 모든 단계가 완료되었을 때만 100%
                              if (completedSteps === 4) {
                                return 100;
                              }
                              
                              // 진행 중인 단계가 있으면 최대 90%까지만
                              return Math.min(progress, 90);
                            })()}%`,
                            background: 'linear-gradient(90deg, #ec4899 0%, #f472b6 25%, #be185d 50%, #f472b6 75%, #ec4899 100%)',
                            backgroundSize: '200% 100%',
                            animation: 'loading 2s ease-in-out infinite'
                          }}
                        />
                        {/* 진행률 표시 오버레이 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white text-xs font-bold drop-shadow-lg">
                            {(() => {
                              let progress = 0;
                              let completedSteps = 0;
                              let totalSteps = 0;
                              
                              if (loadingProgress.companyAnalysis) {
                                progress += 25;
                                completedSteps++;
                                totalSteps++;
                              }
                              if (loadingProgress.questionGeneration) {
                                progress += 40;
                                completedSteps++;
                                totalSteps++;
                              }
                              if (loadingProgress.difficultyClassification) {
                                progress += 20;
                                completedSteps++;
                                totalSteps++;
                              }
                              if (loadingProgress.tipsGeneration) {
                                progress += 15;
                                completedSteps++;
                                totalSteps++;
                              }
                              
                              // 모든 단계가 완료되었을 때만 100%
                              if (completedSteps === 4) {
                                return '100% 완료';
                              }
                              
                              // 진행 중인 단계가 있으면 최대 90%까지만
                              return `${Math.min(progress, 90)}% 완료`;
                            })()}
                          </span>
                        </div>
                      </div>
                      
                      {/* 단계별 진행 상태 */}
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">회사 정보 분석</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              loadingProgress.companyAnalysis ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                            }`}></div>
                            <span className={`font-medium ${
                              loadingProgress.companyAnalysis ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {loadingProgress.companyAnalysis ? '완료' : '대기 중'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">직무별 질문 생성</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              loadingProgress.questionGeneration ? 'bg-pink-500 animate-bounce' : 'bg-gray-400'
                            }`} style={{ animationDelay: '0ms' }}></div>
                            <span className={`font-medium ${
                              loadingProgress.questionGeneration ? 'text-pink-600' : 'text-gray-500'
                            }`}>
                              {loadingProgress.questionGeneration ? '진행 중' : '대기 중'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">난이도별 분류</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              loadingProgress.difficultyClassification ? 'bg-blue-500 animate-bounce' : 'bg-gray-400'
                            }`} style={{ animationDelay: '150ms' }}></div>
                            <span className={`font-medium ${
                              loadingProgress.difficultyClassification ? 'text-blue-600' : 'text-gray-500'
                            }`}>
                              {loadingProgress.difficultyClassification ? '진행 중' : '대기 중'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">답변 팁 생성</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${
                              loadingProgress.tipsGeneration ? 'bg-purple-500 animate-bounce' : 'bg-gray-400'
                            }`} style={{ animationDelay: '300ms' }}></div>
                            <span className={`font-medium ${
                              loadingProgress.tipsGeneration ? 'text-purple-600' : 'text-gray-500'
                            }`}>
                              {loadingProgress.tipsGeneration ? '진행 중' : '대기 중'}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 text-center">
                        <div className="text-sm text-gray-600 mb-2">
                          AI가 {companyName} {jobTitle} 직무에 맞는 맞춤형 면접 질문을 생성하고 있습니다...
                        </div>
                        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span>잠시만 기다려주세요 (약 30-60초 소요)</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                            {companyAnalysis && (
                              <>
                                <li className="text-sm text-blue-800 font-medium">
                                  💡 {companyName}의 {companyAnalysis.coreValues[0]}을 답변에 자연스럽게 포함해보세요
                                </li>
                                <li className="text-sm text-blue-800 font-medium">
                                  💡 {companyAnalysis.keyCompetencies[0]} 역량을 강조하는 구체적인 경험을 언급해보세요
                                </li>
                                <li className="text-sm text-blue-800 font-medium">
                                  💡 {companyAnalysis.idealCandidate}에 맞는 답변 톤을 유지해보세요
                                </li>
                              </>
                            )}
                        </ul>
                      </div>

                        {/* 답변 작성 영역 */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            나의 답변
                          </label>
                          
                          {/* 회사 분석 키워드 표시 */}
                          {companyAnalysis && (
                            <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                              <h5 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                                <Target className="w-4 h-4" />
                                💡 {companyName} 회사 키워드
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                {companyAnalysis.coreValues.slice(0, 3).map((value, idx) => (
                                  <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                    {value}
                                  </span>
                                ))}
                                {companyAnalysis.keyCompetencies.slice(0, 2).map((competency, idx) => (
                                  <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                    {competency}
                                  </span>
                                ))}
                                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                                  {companyAnalysis.idealCandidate.length > 15 ? 
                                    companyAnalysis.idealCandidate.substring(0, 15) + '...' : 
                                    companyAnalysis.idealCandidate}
                                </span>
              </div>
                              <p className="text-xs text-blue-700 mt-2">
                                💡 이 키워드들을 답변에 자연스럽게 포함해보세요!
                              </p>
                            </div>
                          )}
                          
                          <textarea
                            value={question.answer || ''}
                            onChange={(e) => saveAnswer(question.id, e.target.value)}
                            placeholder={companyAnalysis ? 
                              `${companyName}의 ${companyAnalysis.coreValues[0]}, ${companyAnalysis.keyCompetencies[0]} 등을 포함하여 답변해보세요...` : 
                              "답변을 작성해보세요..."
                            }
                            rows={4}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-400 text-black mb-3"
                          />
                          
                          {/* 평가 버튼 */}
                            <div className="flex items-center gap-2 mb-4">
                <button
                                onClick={() => evaluateAnswer(question.id)}
                              disabled={question.evaluating || !question.answer || question.answer.trim().length < 50}
                              className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                                question.evaluating || !question.answer || question.answer.trim().length < 50
                                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                                  : 'bg-blue-500 text-white hover:bg-blue-600'
                              }`}
                              >
                                {question.evaluating ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    평가 중...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4" />
                                  AI에게 분석하기
                                  </>
                                )}
                </button>
                              {question.evaluation && (
                                <span className="text-lg font-bold text-blue-600">
                                  점수: {question.evaluation.totalScore}/10
                                </span>
                              )}
                            {question.answer && question.answer.trim().length < 50 && (
                              <span className="text-sm text-gray-500">
                                최소 50자 이상 작성해주세요
                              </span>
                          )}
                          </div>

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
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-gray-600" />
                          <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden border">
                            <div 
                              className="h-full bg-gradient-to-r from-green-400 to-green-600 audio-gauge-smooth"
                              style={{ width: `${Math.max(voiceAnalysis?.volumeLevel || 0, smoothAudioLevel * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-700 min-w-[3rem]">
                            {Math.round(Math.max(voiceAnalysis?.volumeLevel || 0, smoothAudioLevel * 100))}%
                          </span>
                          <span className="text-xs text-blue-600 font-medium">
                            🔊 실시간
                          </span>
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
                  
                  {/* 회사 분석 키워드 표시 (연습 모드) */}
                  {companyAnalysis && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <h5 className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        💡 {companyName} 회사 키워드
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {companyAnalysis.coreValues.slice(0, 3).map((value, idx) => (
                          <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                            {value}
                          </span>
                        ))}
                        {companyAnalysis.keyCompetencies.slice(0, 2).map((competency, idx) => (
                          <span key={idx} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                            {competency}
                          </span>
                        ))}
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                          {companyAnalysis.idealCandidate.length > 15 ? 
                            companyAnalysis.idealCandidate.substring(0, 15) + '...' : 
                            companyAnalysis.idealCandidate}
                    </span>
                  </div>
                      <p className="text-xs text-blue-700 mt-2">
                        💡 이 키워드들을 답변에 자연스럽게 포함해보세요!
                      </p>
                </div>
              )}

                  <textarea
                    value={questions[currentQuestionIndex].answer || ''}
                    onChange={(e) => saveAnswer(questions[currentQuestionIndex].id, e.target.value)}
                    placeholder={companyAnalysis ? 
                      `${companyName}의 ${companyAnalysis.coreValues[0]}, ${companyAnalysis.keyCompetencies[0]} 등을 포함하여 답변해보세요...` : 
                      "답변을 작성하고 연습해보세요..."
                    }
                    rows={6}
                    className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 placeholder:text-gray-800 text-black mb-4"
                  />
                  
                  {/* 답변 검증 결과 */}
                  {questions[currentQuestionIndex].answer && (
                    <div className="mb-4">
                      {(() => {
                        const validation = validateAnswer(questions[currentQuestionIndex].answer || '');
                        return (
                          <div className={`p-3 rounded-lg border ${
                            validation.isValid 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center gap-2">
                              {validation.isValid ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-600" />
                              )}
                              <span className={`text-sm font-medium ${
                                validation.isValid ? 'text-green-800' : 'text-red-800'
                              }`}>
                                {validation.isValid ? '답변이 적절합니다' : validation.message}
                  </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

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
                    
                    {/* 실시간 볼륨 게이지 */}
                    <div className="mb-6 bg-white rounded-lg p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-blue-900 flex items-center gap-2">
                          <Mic className="w-4 h-4" />
                          실시간 볼륨 레벨
                        </h5>
                        <div className="text-2xl font-bold text-blue-600">{voiceAnalysis.volumeLevel}%</div>
                    </div>
                      <div className="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden border">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-6 rounded-full audio-gauge-smooth"
                          style={{ width: `${voiceAnalysis.volumeLevel}%` }}
                        />
                        {/* 웨이브 효과 */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex items-center gap-1">
                            {[...Array(8)].map((_, i) => (
                              <div
                                key={i}
                                className="w-1 bg-white opacity-80 rounded-full audio-wave"
                                style={{
                                  height: `${Math.max(4, (voiceAnalysis.volumeLevel * 0.2) + (i * 2))}px`,
                                  animationDelay: `${i * 100}ms`,
                                  animationDuration: `${0.5 + (i * 0.1)}s`
                                }}
                              />
                            ))}
                      </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {voiceAnalysis.volumeLevel > 80 ? '🔊 매우 큰 소리' :
                         voiceAnalysis.volumeLevel > 60 ? '🔉 적절한 소리' :
                         voiceAnalysis.volumeLevel > 30 ? '🔈 작은 소리' : '🔇 너무 작은 소리'}
                    </div>
                  </div>

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
                            <div className="space-y-3 text-sm">
                              <div className="p-2 bg-purple-50 rounded">
                                <div className="font-medium text-purple-900 mb-1">음성 톤:</div>
                                <div className="text-purple-700">{voiceEvaluation.tone}</div>
                              </div>
                              <div className="p-2 bg-purple-50 rounded">
                                <div className="font-medium text-purple-900 mb-1">말하기 속도:</div>
                                <div className="text-purple-700">{voiceEvaluation.pace}</div>
                              </div>
                              <div className="p-2 bg-purple-50 rounded">
                                <div className="font-medium text-purple-900 mb-1">음량:</div>
                                <div className="text-purple-700">{voiceEvaluation.volume}</div>
                              </div>
                              <div className="p-2 bg-purple-50 rounded">
                                <div className="font-medium text-purple-900 mb-1">명료도:</div>
                                <div className="text-purple-700">{voiceEvaluation.clarity}</div>
                              </div>
                              <div className="p-2 bg-purple-50 rounded">
                                <div className="font-medium text-purple-900 mb-1">자신감:</div>
                                <div className="text-purple-700">{voiceEvaluation.confidence}</div>
                              </div>
                              <div className="p-2 bg-purple-50 rounded">
                                <div className="font-medium text-purple-900 mb-1">표현력:</div>
                                <div className="text-purple-700">{voiceEvaluation.expressiveness}</div>
                              </div>
                              <div className="p-2 bg-purple-50 rounded">
                                <div className="font-medium text-purple-900 mb-1">구조화:</div>
                                <div className="text-purple-700">{voiceEvaluation.structure}</div>
                              </div>
                                </div>
                              </div>
                              
                          {/* 요약 키워드 */}
                          <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <h5 className="font-medium text-purple-900 mb-3">🔑 요약 키워드</h5>
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                  {voiceEvaluation.overallScore >= 8 ? '우수' : voiceEvaluation.overallScore >= 6 ? '양호' : '개선필요'}
                                </span>
                                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                  {voiceEvaluation.tone.includes('차분') ? '차분함' : voiceEvaluation.tone.includes('자신감') ? '자신감' : '적절함'}
                                </span>
                                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                                  {voiceEvaluation.pace.includes('적절') ? '적절한 속도' : voiceEvaluation.pace.includes('빠름') ? '빠른 속도' : '느린 속도'}
                                </span>
                                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
                                  {voiceEvaluation.clarity.includes('명확') ? '명확한 발음' : '개선필요'}
                                </span>
                                <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm font-medium">
                                  {voiceEvaluation.confidence.includes('자신감') ? '자신감 있음' : '자신감 부족'}
                                </span>
                              </div>
                              <div className="mt-3 p-2 bg-gray-50 rounded">
                                <div className="text-sm text-gray-600 mb-1">핵심 메시지:</div>
                                <div className="text-sm font-medium text-gray-800">
                                  {voiceEvaluation.overallScore >= 8 
                                    ? '전반적으로 우수한 음성 특성을 보여줍니다.' 
                                    : voiceEvaluation.overallScore >= 6 
                                    ? '양호한 수준이지만 일부 개선이 필요합니다.' 
                                    : '음성 표현력 개선이 필요합니다.'}
                                </div>
                                </div>
                              </div>
                            </div>

                          <div className="bg-white rounded-lg p-4 border-2 border-green-200 bg-green-50">
                            <h5 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" />
                              🟢 강점
                            </h5>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                              {voiceEvaluation.strengths.map((strength, idx) => (
                                <li key={idx} className="text-green-800 font-medium bg-green-100 p-2 rounded border-l-4 border-green-400">
                                  {strength}
                                    </li>
                                  ))}
                                </ul>
                          </div>
                              </div>
                              
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white rounded-lg p-4 border-2 border-red-200 bg-red-50">
                            <h5 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              🔴 개선점 (중요)
                            </h5>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                              {voiceEvaluation.improvements.map((improvement, idx) => (
                                <li key={idx} className="text-red-800 font-medium bg-red-100 p-2 rounded border-l-4 border-red-400">
                                  {improvement}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="bg-white rounded-lg p-4 border-2 border-blue-200 bg-blue-50">
                            <h5 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                              <Lightbulb className="w-4 h-4" />
                              🔵 추천사항
                            </h5>
                            <ul className="list-disc list-inside space-y-2 text-sm">
                              {voiceEvaluation.recommendations.map((recommendation, idx) => (
                                <li key={idx} className="text-blue-800 font-medium bg-blue-100 p-2 rounded border-l-4 border-blue-400">
                                  {recommendation}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                        {/* 상세 분석 */}
                        {voiceEvaluation.detailedAnalysis && (
                          <div className="bg-white rounded-lg p-4 border-2 border-purple-200 bg-purple-50">
                            <h5 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                              <BarChart3 className="w-4 h-4" />
                              📋 상세 분석
                            </h5>
                            <div className="text-purple-800 font-medium bg-purple-100 p-3 rounded border-l-4 border-purple-400">
                              {voiceEvaluation.detailedAnalysis}
                            </div>
                              </div>
                            )}
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
    </>
  );
} 
