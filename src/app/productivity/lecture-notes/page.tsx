"use client";
import { useState, useRef, useEffect } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  ArrowLeft, Mic, Square, Pause, Play, Clock, Download, Copy, FileText, 
  Loader2, AlertCircle, CheckCircle
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

type RecordingState = 'idle' | 'recording' | 'paused' | 'completed';

export default function LectureNotes() {
  const router = useRouter();
  
  // 녹음 상태 관리
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // 텍스트 변환 및 요약
  const [realTimeText, setRealTimeText] = useState('');
  const [realTimeSummary, setRealTimeSummary] = useState('');
  const [finalSummary, setFinalSummary] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  
  // UI 상태
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'ready' | 'recording' | 'processing' | 'complete'>('ready');
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // 타이머 시작/정지
  useEffect(() => {
    if (recordingState === 'recording') {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
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
  }, [recordingState]);

  // 컴포넌트 언마운트 시 리소스 정리
  useEffect(() => {
    return () => {
      cleanupResources();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 시간 포맷팅
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 음성 레벨 모니터링 시작
  const startAudioLevelMonitoring = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateAudioLevel = () => {
      if (!analyserRef.current || recordingState !== 'recording') return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalizedLevel = Math.floor((average / 255) * 10);
      setAudioLevel(normalizedLevel);
      
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };
    
    updateAudioLevel();
  };

  // 녹음 처리
  const processRecording = async () => {
    if (audioChunksRef.current.length === 0) {
      setError('녹음 데이터가 없습니다.');
      setCurrentStep('ready');
      setRecordingState('idle');
      return;
    }

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log('녹음 완료. 크기:', audioBlob.size, 'bytes');
      
      // 1단계: 음성을 텍스트로 변환
      console.log('음성 변환 시작...');
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const transcribeResponse = await fetch('/api/lecture-notes/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeResponse.ok) {
        const errorData = await transcribeResponse.json();
        throw new Error(errorData.error || '음성 변환에 실패했습니다.');
      }

      const transcribeData = await transcribeResponse.json();
      const transcript = transcribeData.transcript;
      
      console.log('음성 변환 완료:', transcript.length, '문자');
      setFinalTranscript(transcript);

      // 2단계: 최종 요약 생성
      console.log('요약 생성 시작...');
      const summaryResponse = await fetch('/api/lecture-notes/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcript,
          summaryType: 'final'
        }),
      });

      if (!summaryResponse.ok) {
        const errorData = await summaryResponse.json();
        throw new Error(errorData.error || '요약 생성에 실패했습니다.');
      }

      const summaryData = await summaryResponse.json();
      console.log('요약 생성 완료:', summaryData.summary.length, '문자');
      
      setFinalSummary(summaryData.summary);
      setCurrentStep('complete');
      
    } catch (error) {
      console.error('녹음 처리 오류:', error);
      setError(error instanceof Error ? error.message : '녹음 처리 중 오류가 발생했습니다.');
      setCurrentStep('ready');
      setRecordingState('idle');
    } finally {
      // setLoading(false); // Removed loading state
    }
  };

  // 리소스 정리
  const cleanupResources = () => {
    // 오디오 스트림 정지
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // AudioContext 정리
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // 애니메이션 프레임 정리
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // MediaRecorder 정리
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current = null;
    }
  };

  // 녹음 시작
  const startRecording = async () => {
    try {
      setError(null);
      setCurrentStep('recording');
      setRecordingState('recording');
      setRecordingTime(0);
      setRealTimeText('');
      setRealTimeSummary('');
      audioChunksRef.current = [];
      
      // 마이크 권한 요청 및 스트림 획득
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      streamRef.current = stream;

      // AudioContext 설정 (음성 레벨 시각화용)
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // MediaRecorder 설정
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // 데이터 수집
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 녹음 완료 시 처리
      mediaRecorderRef.current.onstop = () => {
        processRecording();
      };

      // 녹음 시작
      mediaRecorderRef.current.start(1000); // 1초마다 데이터 수집
      startAudioLevelMonitoring();
      
      console.log('녹음 시작됨');
    } catch (error) {
      console.error('녹음 시작 오류:', error);
      setError('마이크 접근 권한이 필요합니다. 브라우저에서 마이크 권한을 허용해주세요.');
      setRecordingState('idle');
      setCurrentStep('ready');
    }
  };

  // 녹음 일시정지/재개
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;

    if (recordingState === 'recording') {
      setRecordingState('paused');
      mediaRecorderRef.current.pause();
      // 애니메이션 프레임 정지
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      console.log('녹음 일시정지');
    } else if (recordingState === 'paused') {
      setRecordingState('recording');
      mediaRecorderRef.current.resume();
      startAudioLevelMonitoring(); // 음성 레벨 모니터링 재시작
      console.log('녹음 재개');
    }
  };

  // 녹음 중지
  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    setRecordingState('completed');
    setCurrentStep('processing');
    // setLoading(true); // Removed loading state
    
    // 애니메이션 프레임 정지
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // MediaRecorder 중지 (이때 onstop 이벤트가 발생하여 processRecording 호출됨)
    mediaRecorderRef.current.stop();
    
    // 스트림 정지
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    console.log('녹음 중지 및 최종 처리 시작');
  };

  // 새 녹음 시작
  const resetRecording = () => {
    cleanupResources(); // 리소스 정리
    setRecordingState('idle');
    setCurrentStep('ready');
    setRecordingTime(0);
    setRealTimeText('');
    setRealTimeSummary('');
    setFinalTranscript('');
    setFinalSummary('');
    setError(null);
    setAudioLevel(0);
    audioChunksRef.current = [];
  };

  // 텍스트 복사
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: 토스트 알림 추가
  };

  // 다운로드 기능
  const downloadTranscript = () => {
    const content = `강의 녹음 전문\n\n${finalTranscript}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `강의녹음_전문_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadSummary = () => {
    const content = `강의 요약\n\n${finalSummary}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `강의녹음_요약_${new Date().toISOString().split('T')[0]}.txt`;
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
                <div className="bg-red-500 p-3 rounded-xl">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">강의 녹음 노트</h1>
                  <p className="text-gray-600 mt-1">대화를 녹음하고 실시간 요약과 최종 요약을 받아보세요</p>
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

            {/* 녹음 컨트롤 영역 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">녹음 컨트롤</h2>
              
              {/* 녹음 상태 표시 */}
              <div className="text-center mb-8">
                <div className="mb-4">
                  {recordingState === 'idle' && (
                    <div className="text-gray-500 text-lg">녹음을 시작하려면 아래 버튼을 클릭하세요</div>
                  )}
                  {recordingState === 'recording' && (
                    <div className="flex items-center justify-center gap-2 text-red-500 text-lg">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      녹음 중
                    </div>
                  )}
                  {recordingState === 'paused' && (
                    <div className="text-yellow-500 text-lg">녹음 일시정지</div>
                  )}
                  {recordingState === 'completed' && (
                    <div className="flex items-center justify-center gap-2 text-green-500 text-lg">
                      <CheckCircle className="w-5 h-5" />
                      녹음 완료
                    </div>
                  )}
                </div>

                {/* 시간 표시 */}
                <div className="text-4xl font-mono font-bold text-gray-800 mb-6">
                  {formatTime(recordingTime)}
                </div>

                {/* 음성 레벨 표시 (시각적 효과) */}
                {recordingState === 'recording' && (
                  <div className="flex items-center justify-center gap-1 mb-6">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-2 bg-blue-400 rounded-full transition-all duration-150 ${
                          i < audioLevel ? 'h-8' : 'h-2'
                        }`}
                        style={{
                          animationDelay: `${i * 0.1}s`,
                          animation: recordingState === 'recording' ? 'pulse 1s infinite' : 'none'
                        }}
                      ></div>
                    ))}
                  </div>
                )}
              </div>

              {/* 컨트롤 버튼들 */}
              <div className="flex items-center justify-center gap-4">
                {recordingState === 'idle' && (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-3 bg-red-500 text-white px-8 py-4 rounded-xl hover:bg-red-600 transition-colors font-semibold text-lg"
                  >
                    <Mic className="w-6 h-6" />
                    녹음 시작
                  </button>
                )}

                {(recordingState === 'recording' || recordingState === 'paused') && (
                  <>
                    <button
                      onClick={togglePause}
                      className="flex items-center gap-3 bg-yellow-500 text-white px-6 py-4 rounded-xl hover:bg-yellow-600 transition-colors font-semibold"
                    >
                      {recordingState === 'recording' ? (
                        <>
                          <Pause className="w-5 h-5" />
                          일시정지
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5" />
                          재개
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-3 bg-gray-700 text-white px-6 py-4 rounded-xl hover:bg-gray-800 transition-colors font-semibold"
                    >
                      <Square className="w-5 h-5" />
                      녹음 완료
                    </button>
                  </>
                )}

                {recordingState === 'completed' && currentStep === 'complete' && (
                  <button
                    onClick={resetRecording}
                    className="flex items-center gap-3 bg-blue-500 text-white px-6 py-4 rounded-xl hover:bg-blue-600 transition-colors font-semibold"
                  >
                    <Mic className="w-5 h-5" />
                    새 녹음 시작
                  </button>
                )}
              </div>
            </div>

            {/* 실시간 변환/요약 영역 */}
            {(recordingState === 'recording' || recordingState === 'paused') && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* 실시간 텍스트 변환 */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    실시간 텍스트 변환
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
                    {realTimeText ? (
                      <p className="text-gray-700 leading-relaxed">{realTimeText}</p>
                    ) : (
                      <p className="text-gray-400 italic">음성을 텍스트로 변환 중...</p>
                    )}
                  </div>
                </div>

                {/* 실시간 요약 */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    실시간 요약
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
                    {realTimeSummary ? (
                      <p className="text-gray-700 leading-relaxed">{realTimeSummary}</p>
                    ) : (
                      <p className="text-gray-400 italic">내용을 요약하는 중...</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 최종 결과 영역 */}
            {currentStep === 'processing' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">최종 처리 중...</h3>
                <p className="text-gray-600">녹음된 내용을 분석하고 정리하고 있습니다.</p>
              </div>
            )}

            {currentStep === 'complete' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 최종 전문 */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      전체 텍스트 전문
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(finalTranscript)}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        title="복사"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button
                        onClick={downloadTranscript}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        title="다운로드"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{finalTranscript}</p>
                  </div>
                </div>

                {/* 최종 요약 */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      최종 요약
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(finalSummary)}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        title="복사"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button
                        onClick={downloadSummary}
                        className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        title="다운로드"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 max-h-[400px] overflow-y-auto">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{finalSummary}</p>
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