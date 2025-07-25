"use client";
import { useState } from "react";
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import {
  Download, X
} from 'lucide-react';
import Image from 'next/image';

export default function VideoCreate() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);

  const handleReferenceImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setReferenceImage(e.target?.result as string);
      setReferenceImageFile(file);
    };
    reader.readAsDataURL(file);
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImageFile(null);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setVideoUrl(null);
    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('duration', duration);
      formData.append('aspectRatio', aspectRatio);
      if (referenceImageFile) {
        formData.append('referenceImage', referenceImageFile);
      }

      const res = await fetch("/api/video-generate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.url) {
        setVideoUrl(data.url);
      } else {
        setError("영상 생성에 실패했습니다.");
      }
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white">
        <div className="flex">
          {/* 공통 사이드바 */}
          <Sidebar currentPath="/video-create" />
          
          {/* 메인 콘텐츠 */}
          <div className="flex-1 flex">
            {/* 입력 영역 */}
            <section className="flex flex-col justify-center items-center w-2/5 min-h-[calc(100vh-64px)] px-12">
              <div className="w-full max-w-md rounded-2xl bg-[#f9f9fb] p-8" style={{ boxShadow: 'none', border: '1.5px solid #f3f4f6', minHeight: '950px' }}>
                <h2 className="text-2xl font-bold mb-8">영상 제작</h2>
                <label className="font-semibold mb-1">영상 설명 <span className="text-blue-500">*</span></label>
                <textarea
                  className="w-full h-24 p-4 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none text-gray-900 mb-2"
                  placeholder="예) 하늘에서 나는 앵무새를 그려줘"
                  maxLength={300}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  disabled={loading}
                />
                <div className="text-right text-xs text-gray-400 mb-4">{prompt.length}/300</div>
                
                {/* 참고 이미지 첨부 버튼 */}
                <div className="flex items-center gap-2 mb-6">
                  <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-blue-600 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleReferenceImageUpload(file);
                        }
                      }}
                    />
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center hover:bg-blue-100 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <span className="text-sm">참고 이미지 첨부</span>
                  </label>
                  {referenceImage && (
                    <button
                      onClick={removeReferenceImage}
                      className="flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-sm">제거</span>
                    </button>
                  )}
                </div>
                
                {/* 참고 이미지 미리보기 */}
                {referenceImage && (
                  <div className="mb-6">
                    <div className="relative inline-block">
                      <Image
                        src={referenceImage}
                        alt="참고 이미지"
                        width={80}
                        height={80}
                        className="object-cover rounded-lg border border-gray-200"
                      />
                      <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs px-1 rounded-full">
                        첨부됨
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      참고 이미지의 스타일이 생성 결과에 반영됩니다.
                    </div>
                    <div className="mt-1 text-xs text-blue-500">
                      💡 팁: 참고 이미지의 아트 스타일, 색감, 구도가 새 영상에 적용됩니다.
                    </div>
                  </div>
                )}
                
                <label className="font-semibold mb-1 mt-2">영상 길이 <span className="text-blue-500">*</span></label>
                <div className="flex gap-4 mb-6">
                  <button
                    className={`flex-1 py-2 rounded-lg border ${duration === "5" ? "bg-black text-white border-black" : "bg-white text-gray-800 border-gray-200"}`}
                    onClick={() => setDuration("5")}
                    disabled={loading}
                  >
                    5초
                  </button>
                  <button
                    className={`flex-1 py-2 rounded-lg border ${duration === "10" ? "bg-black text-white border-black" : "bg-white text-gray-800 border-gray-200"}`}
                    onClick={() => setDuration("10")}
                    disabled={loading}
                  >
                    10초
                  </button>
                </div>

                <label className="font-semibold mb-1 mt-2">영상 비율 <span className="text-blue-500">*</span></label>
                <div className="flex gap-4 mb-6">
                  <button
                    className={`flex-1 py-2 rounded-lg border ${aspectRatio === "16:9" ? "bg-black text-white border-black" : "bg-white text-gray-800 border-gray-200"}`}
                    onClick={() => setAspectRatio("16:9")}
                    disabled={loading}
                  >
                    16:9
                  </button>
                  <button
                    className={`flex-1 py-2 rounded-lg border ${aspectRatio === "9:16" ? "bg-black text-white border-black" : "bg-white text-gray-800 border-gray-200"}`}
                    onClick={() => setAspectRatio("9:16")}
                    disabled={loading}
                  >
                    9:16
                  </button>
                </div>
                <button
                  className="w-full py-3 rounded-xl bg-black text-white font-bold text-lg shadow hover:bg-gray-800 transition-colors disabled:bg-gray-300"
                  onClick={handleGenerate}
                  disabled={loading || !prompt.trim()}
                >
                  {loading ? "생성 중..." : "영상 생성"}
                </button>
                
                {error && (
                  <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}
              </div>
            </section>

            {/* 결과 영역 */}
            <section className="flex-1 bg-gray-50 p-8">
              <h3 className="text-xl font-bold mb-6">생성 결과</h3>
              <div className="bg-white rounded-lg p-6 shadow-sm">
                {videoUrl ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">생성된 영상</h4>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = videoUrl;
                          link.download = 'generated-video.mp4';
                          link.click();
                        }}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <Download className="w-4 h-4" />
                        다운로드
                      </button>
                    </div>
                    <video
                      src={videoUrl}
                      controls
                      className="w-full rounded-lg"
                      style={{
                        aspectRatio: aspectRatio === "16:9" ? "16/9" : "9/16",
                        maxHeight: "400px"
                      }}
                    >
                      브라우저가 비디오를 지원하지 않습니다.
                    </video>
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      {loading ? "영상 생성 중..." : "영상이 생성되지 않았습니다"}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
} 