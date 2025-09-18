"use client";

import React, { useState } from "react";
import Header from '../../components/Header';
import { ArrowLeft, BookOpen, Upload, Mic, FileText, Copy, Loader2, Play, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/contexts/ToastContext";
import { createUsageToastData, createUsageToastMessage } from "@/lib/toast-utils";

export default function LectureNotes() {
  const router = useRouter();
  const { showToast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [chunksDone, setChunksDone] = useState(0);
  const [chunksTotal, setChunksTotal] = useState(0);

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
      // WAV 인코딩 (mono 16k) 유틸
      const encodeWavMono16k = (audioBuffer: AudioBuffer, startSec: number, endSec: number): Blob => {
        const targetRate = 16000;
        const srcRate = audioBuffer.sampleRate;
        const startSample = Math.floor(startSec * srcRate);
        const endSample = Math.min(Math.floor(endSec * srcRate), audioBuffer.length);
        const frameCount = Math.max(0, endSample - startSample);

        // 채널 합성 (모노)
        const mixed = new Float32Array(frameCount);
        for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
          const data = audioBuffer.getChannelData(ch);
          for (let i = 0; i < frameCount; i++) mixed[i] += data[startSample + i] / audioBuffer.numberOfChannels;
        }

        // 리샘플링 (근사 디시메이션)
        const ratio = srcRate / targetRate;
        const outLen = Math.floor(frameCount / ratio);
        const pcm16 = new Int16Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const srcIndex = Math.floor(i * ratio);
          let s = mixed[srcIndex];
          if (s > 1) s = 1; if (s < -1) s = -1;
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // WAV 헤더
        const dataSize = pcm16.length * 2;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        const writeStr = (off: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, targetRate, true);
        view.setUint32(28, targetRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);
        const out = new DataView(buffer, 44);
        for (let i = 0; i < pcm16.length; i++) out.setInt16(i * 2, pcm16[i], true);
        return new Blob([buffer], { type: 'audio/wav' });
      };

      // 파일을 10분 단위 WAV 청크로 분할
      const splitFileToWavChunks = async (file: Blob, chunkSec = 600): Promise<Blob[]> => {
        const arrayBuf = await file.arrayBuffer();
        const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AC();
        const audioBuf: AudioBuffer = await new Promise((resolve, reject) => {
          audioCtx.decodeAudioData(arrayBuf.slice(0), resolve, reject);
        });
        const duration = audioBuf.duration;
        const chunks: Blob[] = [];
        for (let start = 0; start < duration; start += chunkSec) {
          const end = Math.min(start + chunkSec, duration);
          chunks.push(encodeWavMono16k(audioBuf, start, end));
        }
        audioCtx.close();
        return chunks;
      };

      const uploadAndTranscribe = async (blob: Blob, baseName = 'audio'): Promise<string> => {
        const formData = new FormData();
        const ext = (blob.type.split('/')[1] || 'wav').toLowerCase();
        formData.append('audio', new File([blob], `${baseName}_${Date.now()}.${ext}`, { type: blob.type || 'audio/wav' }));
        const res = await fetch('/api/lecture-notes/transcribe', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '음성 인식에 실패했습니다.');
        return data.transcription || data.transcript || '';
      };

      const MAX_SINGLE = 25 * 1024 * 1024; // Whisper 제한 우회
      let transcriptionText = '';
      setChunksDone(0); setChunksTotal(0);
      if (audioBlob.size > MAX_SINGLE) {
        const chunks = await splitFileToWavChunks(audioBlob, 600);
        setChunksTotal(chunks.length);
        const parts: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const t = await uploadAndTranscribe(chunks[i], `audio_part${i + 1}`);
          parts.push(t);
          setChunksDone(i + 1);
          setTranscription(parts.join('\n\n'));
        }
        transcriptionText = parts.join('\n\n');
      } else {
        transcriptionText = await uploadAndTranscribe(audioBlob, 'audio');
        setChunksTotal(1); setChunksDone(1);
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
        if (summarizeData.usage) {
          const toastData = createUsageToastData('lecture-notes', summarizeData.usage.current, summarizeData.usage.limit);
          showToast({ type: 'success', title: `${toastData.serviceName} 사용`, message: createUsageToastMessage(toastData), duration: 5000 });
        } else {
          const toastData = createUsageToastData('lecture-notes', 0, 30);
          showToast({ type: 'success', title: `${toastData.serviceName} 사용`, message: createUsageToastMessage(toastData), duration: 5000 });
        }
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
        if (data.usage) {
          const toastData = createUsageToastData('lecture-notes', data.usage.current, data.usage.limit);
          showToast({ type: 'success', title: `${toastData.serviceName} 사용`, message: createUsageToastMessage(toastData), duration: 5000 });
        } else {
          const toastData = createUsageToastData('lecture-notes', 0, 30);
          showToast({ type: 'success', title: `${toastData.serviceName} 사용`, message: createUsageToastMessage(toastData), duration: 5000 });
        }
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

  const downloadDocx = async (text: string, filename: string, title?: string) => {
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      const children: any[] = [];
      if (title && title.trim().length > 0) {
        children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
      }
      for (const line of text.split('\n')) {
        children.push(new Paragraph({ children: [new TextRun({ text: line })] }));
      }
      const doc = new Document({ sections: [{ properties: {}, children }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('DOCX 생성 오류:', e);
      alert('Word 파일 생성 중 오류가 발생했습니다.');
    }
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
        <div className="max-w-[100rem] mx-auto">
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
            <h1 className="text-3xl font-bold text-gray-900">강의 녹음 노트</h1>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  <div className="flex flex-col items-center">
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
                    <p className="text-sm text-gray-500 mb-4">MP3, WAV, WEBM 권장<br/>(M4A는 일부 파일에서 문제가 있을 수 있습니다)</p>
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
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="text-blue-800 font-medium">오디오 파일이 준비되었습니다</span>
                      </div>
                      <p className="text-blue-700 text-sm mt-1">
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
                        {chunksTotal > 0 ? `변환 중 ${chunksDone}/${chunksTotal}` : '변환 및 요약 중...'}
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



              {/* 초기화 버튼 제거 */}
            </div>

            {/* 가운데: 변환된 텍스트 */}
            <div className="space-y-6">
              {transcription ? (
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
                        onClick={() => downloadDocx(transcription, '강의_텍스트.docx', '변환된 텍스트')}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 h-[40rem] overflow-y-auto w-full">
                    <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                      {transcription}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="text-center text-gray-500">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <div className="font-medium">변환된 텍스트가 여기에 표시됩니다</div>
                    <div className="text-sm mt-2">오디오를 업로드하거나 녹음하여 텍스트로 변환해보세요</div>
                  </div>
                </div>
              )}
            </div>

            {/* 오른쪽: 강의 요약 */}
            <div className="space-y-6">
              {summary ? (
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
                        onClick={() => downloadDocx(summary, '강의_요약.docx', '강의 요약')}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 h-[40rem] overflow-y-auto w-full">
                    <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                      {summary}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="text-center text-gray-500">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <div className="font-medium">강의 요약이 여기에 표시됩니다</div>
                    <div className="text-sm mt-2">오디오를 업로드하거나 녹음하여 요약을 생성해보세요</div>
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