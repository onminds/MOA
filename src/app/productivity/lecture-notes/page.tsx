"use client";

import React, { useState } from "react";
import Header from '../../components/Header';
import { ArrowLeft, BookOpen, Upload, Mic, FileText, Download, Copy, Loader2, Play, Pause, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LectureNotes() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        
        // 녹음 파일 크기 제한 (25MB)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (blob.size > maxSize) {
          setError(`녹음 파일이 너무 큽니다. 최대 25MB까지 지원됩니다. (현재: ${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        
        setAudioBlob(blob);
        setAudioChunks(chunks);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setError(null);
    } catch (error) {
      console.error('녹음 시작 오류:', error);
      setError('마이크 접근 권한이 필요합니다.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 파일 크기 제한 (25MB)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        setError(`파일 크기가 너무 큽니다. 최대 25MB까지 지원됩니다. (현재: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
        return;
      }
      
      setAudioBlob(file);
      setError(null);
    }
  };

  const transcribeAndSummarize = async () => {
    if (!audioBlob) {
      setError('오디오 파일을 먼저 업로드하거나 녹음해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      // 파일명을 안전한 형식으로 생성
      let filename = 'audio.webm';
      if (audioBlob instanceof File) {
        // 원본 파일명에서 확장자만 추출
        const originalName = audioBlob.name;
        const extension = originalName.split('.').pop()?.toLowerCase() || 'webm';
        // 안전한 파일명 생성 (타임스탬프 + 확장자)
        const timestamp = Date.now();
        filename = `audio_${timestamp}.${extension}`;
      } else if (audioBlob.type) {
        // Blob의 MIME 타입에 따라 확장자 결정
        const extension = audioBlob.type.split('/')[1] || 'webm';
        const timestamp = Date.now();
        filename = `audio_${timestamp}.${extension}`;
      }
      
      formData.append('audio', audioBlob, filename);

      // 1단계: 음성 변환
      const transcribeResponse = await fetch('/api/lecture-notes/transcribe', {
        method: 'POST',
        body: formData,
      });

      const transcribeData = await transcribeResponse.json();

      if (!transcribeResponse.ok) {
        throw new Error(transcribeData.error || '음성 인식에 실패했습니다.');
      }

      const transcriptionText = transcribeData.transcription || transcribeData.transcript;
      if (!transcriptionText) {
        throw new Error('음성 인식 결과를 받지 못했습니다.');
      }

      setTranscription(transcriptionText);

      // 2단계: 요약 생성
      const summarizeResponse = await fetch('/api/lecture-notes/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcriptionText.trim(),
        }),
      });

      const summarizeData = await summarizeResponse.json();

      if (!summarizeResponse.ok) {
        throw new Error(summarizeData.error || '요약 생성에 실패했습니다.');
      }

      if (summarizeData.summary) {
        setSummary(summarizeData.summary);
      } else {
        throw new Error('요약 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('음성 변환 및 요약 오류:', error);
      setError(error instanceof Error ? error.message : '음성 변환 및 요약 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async () => {
    if (!transcription.trim()) {
      setError('먼저 음성을 텍스트로 변환해주세요.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lecture-notes/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcription.trim(),
        }),
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 복사되었습니다!');
  };

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    setIsRecording(false);
    setAudioBlob(null);
    setTranscription('');
    setSummary('');
    setError(null);
    setMediaRecorder(null);
    setAudioChunks([]);
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
            <h1 className="text-3xl font-bold text-gray-900">강의 노트 작성</h1>
            <p className="text-gray-600 text-lg mt-2">
              음성 녹음이나 파일 업로드로 강의 내용을 텍스트로 변환하고 요약해보세요.
            </p>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="text-red-700 font-medium">오류 발생</div>
              <div className="text-red-600 text-sm mt-1">{error}</div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 입력 영역 */}
            <div className="space-y-6">
              {/* 오디오 입력 */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                  <Mic className="w-6 h-6" />
                  오디오 입력
                </h2>

                <div className="space-y-4">
                  {/* 녹음 버튼 */}
                  <div className="text-center">
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={loading}
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isRecording 
                          ? 'bg-red-500 hover:bg-red-600 text-white' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isRecording ? (
                        <Square className="w-6 h-6" />
                      ) : (
                        <Mic className="w-6 h-6" />
                      )}
                    </button>
                    <p className="text-sm text-gray-600 mt-2">
                      {isRecording ? '녹음 중... 클릭하여 정지' : '클릭하여 녹음 시작'}
                    </p>
                  </div>

                  {/* 또는 구분선 */}
                  <div className="flex items-center">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-4 text-sm text-gray-500">또는</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  {/* 파일 업로드 */}
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600 mb-2">오디오 파일을 업로드하세요</p>
                    <p className="text-sm text-gray-500 mb-4">MP3, WAV, WEBM 권장 (M4A는 일부 파일에서 문제가 있을 수 있습니다)</p>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="audio-upload"
                    />
                    <label
                      htmlFor="audio-upload"
                      className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer transition-colors"
                    >
                      파일 선택
                    </label>
                  </div>

                  {/* 업로드된 파일 정보 */}
                  {audioBlob && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <span className="text-green-800 font-medium">오디오 파일이 준비되었습니다</span>
                      </div>
                      <p className="text-green-700 text-sm mt-1">
                        파일 크기: {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  )}

                  {/* 변환 및 요약 버튼 */}
                  <button
                    onClick={transcribeAndSummarize}
                    disabled={!audioBlob || loading}
                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        변환 및 요약 중...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Play className="w-5 h-5" />
                        텍스트 변환 및 요약
                      </div>
                    )}
                  </button>
                </div>
              </div>



              {/* 초기화 버튼 */}
              <button
                onClick={resetAll}
                className="w-full py-3 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all duration-200"
              >
                처음부터 다시
              </button>
            </div>

            {/* 결과 영역 */}
            <div className="space-y-6">
              {/* 변환된 텍스트 */}
              {transcription && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <FileText className="w-6 h-6" />
                      변환된 텍스트
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(transcription)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => downloadText(transcription, '강의_텍스트.txt')}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                      {transcription}
                    </div>
                  </div>
                </div>
              )}

              {/* 요약 결과 */}
              {summary && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <BookOpen className="w-6 h-6" />
                      강의 요약
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(summary)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => downloadText(summary, '강의_요약.txt')}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                      {summary}
                    </div>
                  </div>
                </div>
              )}

              {/* 안내 메시지 */}
              {!transcription && !summary && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="text-center text-gray-500">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <div className="font-medium">변환된 텍스트가 여기에 표시됩니다</div>
                    <div className="text-sm mt-2">오디오를 업로드하거나 녹음하여 텍스트로 변환해보세요</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 