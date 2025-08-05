"use client";

import React, { useState } from "react";
import Header from '../../components/Header';
import { ArrowLeft, Briefcase, User, Lightbulb, Play, CheckCircle, AlertCircle, Building2 } from 'lucide-react';
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
  const [currentStep, setCurrentStep] = useState<InterviewStep>('input');
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [experience, setExperience] = useState('');
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const generateQuestions = async () => {
    if (!company.trim() || !position.trim() || !experience.trim()) {
      setError('모든 필드를 입력해주세요.');
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
          company: company.trim(),
          position: position.trim(),
          experience: experience.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '면접 질문 생성에 실패했습니다.');
      }

      if (data.questions && Array.isArray(data.questions)) {
        const formattedQuestions: InterviewQuestion[] = data.questions.map((q: any, index: number) => ({
          id: index + 1,
          category: q.category || '일반',
          question: q.question,
          difficulty: q.difficulty || 'medium',
          tips: q.tips || [],
        }));

        setQuestions(formattedQuestions);
        setCurrentStep('questions');
      } else {
        throw new Error('면접 질문을 받지 못했습니다.');
      }
    } catch (error) {
      console.error('면접 질문 생성 오류:', error);
      setError(error instanceof Error ? error.message : '면접 질문 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const startPractice = () => {
    setCurrentStep('practice');
    setCurrentQuestionIndex(0);
    setTimer(0);
    setIsTimerRunning(false);
  };

  const toggleTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  const resetTimer = () => {
    setTimer(0);
    setIsTimerRunning(false);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const restartInterview = () => {
    setCurrentStep('input');
    setCompany('');
    setPosition('');
    setExperience('');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setTimer(0);
    setIsTimerRunning(false);
    setError(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 복사되었습니다!');
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      startAudioLevelMonitoring(stream);
    } catch (error) {
      console.error('마이크 접근 오류:', error);
      setError('마이크 접근 권한이 필요합니다.');
    }
  };

  const stopVoiceRecording = () => {
    setIsRecording(false);
    setAudioLevel(0);
  };

  const startAudioLevelMonitoring = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    scriptProcessor.onaudioprocess = () => {
      const array = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(array);
      const values = array.reduce((a, b) => a + b) / array.length;
      setAudioLevel(values);
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
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
            <h1 className="text-3xl font-bold text-gray-900">면접 준비</h1>
            <p className="text-gray-600 text-lg mt-2">
              AI가 생성한 맞춤형 면접 질문으로 완벽하게 준비하세요.
            </p>
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
                  <li>• 잠시 후 다시 시도해주세요</li>
                  <li>• 회사명을 정확히 입력했는지 확인해주세요</li>
                  <li>• 인터넷 연결 상태를 확인해주세요</li>
                  <li>• 문제가 지속되면 다른 회사명으로 시도해보세요</li>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    회사명
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="예: 구글, 네이버, 카카오"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    지원 직무
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    placeholder="예: 프론트엔드 개발자"
                    required
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  관련 경험
                </label>
                <textarea
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  rows={4}
                  placeholder="해당 직무와 관련된 경험을 자세히 설명해주세요..."
                  required
                />
              </div>

              <button
                onClick={generateQuestions}
                disabled={loading || !company.trim() || !position.trim() || !experience.trim()}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    면접 질문 생성 중...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" />
                    면접 질문 생성
                  </div>
                )}
              </button>
            </div>
          )}

          {/* 2단계: 질문 목록 */}
          {currentStep === 'questions' && questions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">생성된 면접 질문</h2>
                <button
                  onClick={startPractice}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg transform hover:scale-105 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  연습 시작
                </button>
              </div>

              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{question.question}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                              {question.category}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              question.difficulty === 'easy' ? 'bg-green-100 text-green-600' :
                              question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-red-100 text-red-600'
                            }`}>
                              {question.difficulty === 'easy' ? '쉬움' :
                               question.difficulty === 'medium' ? '보통' : '어려움'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {question.tips.length > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 답변 팁</h4>
                        <ul className="text-sm text-blue-700 space-y-1">
                          {question.tips.map((tip, tipIndex) => (
                            <li key={tipIndex} className="flex items-start gap-2">
                              <span className="text-blue-500 mt-1">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={restartInterview}
                  className="px-6 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all duration-200"
                >
                  처음부터 다시
                </button>
                <button
                  onClick={startPractice}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 shadow-lg transform hover:scale-105 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  연습 시작
                </button>
              </div>
            </div>
          )}

          {/* 3단계: 연습 모드 */}
          {currentStep === 'practice' && questions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">면접 연습</h2>
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-bold text-pink-600">
                    {formatTime(timer)}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={toggleTimer}
                      className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
                    >
                      {isTimerRunning ? '일시정지' : '시작'}
                    </button>
                    <button
                      onClick={resetTimer}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      리셋
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">
                    질문 {currentQuestionIndex + 1} / {questions.length}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={prevQuestion}
                      disabled={currentQuestionIndex === 0}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    <button
                      onClick={nextQuestion}
                      disabled={currentQuestionIndex === questions.length - 1}
                      className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-sm font-bold">
                      {currentQuestionIndex + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {questions[currentQuestionIndex].question}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                          {questions[currentQuestionIndex].category}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          questions[currentQuestionIndex].difficulty === 'easy' ? 'bg-green-100 text-green-600' :
                          questions[currentQuestionIndex].difficulty === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-red-100 text-red-600'
                        }`}>
                          {questions[currentQuestionIndex].difficulty === 'easy' ? '쉬움' :
                           questions[currentQuestionIndex].difficulty === 'medium' ? '보통' : '어려움'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {questions[currentQuestionIndex].tips.length > 0 && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-800 mb-2">💡 답변 팁</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        {questions[currentQuestionIndex].tips.map((tip, tipIndex) => (
                          <li key={tipIndex} className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={restartInterview}
                  className="px-6 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all duration-200"
                >
                  처음부터 다시
                </button>
                <button
                  onClick={() => copyToClipboard(questions[currentQuestionIndex].question)}
                  className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-all duration-200"
                >
                  질문 복사
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 