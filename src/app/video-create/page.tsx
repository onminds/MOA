"use client";
import { useState } from "react";
import Header from '../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, LogIn, Download, X
} from 'lucide-react';

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
      <div className="min-h-screen bg-white flex flex-row w-full">
        {/* 왼쪽 사이드바 */}
        <aside className="w-64 bg-gray-50 min-h-screen p-6 flex-col justify-between hidden md:flex">
          <nav className="space-y-2">
            {sideMenus.map((menu) => (
              <a
                key={menu.name}
                href={menu.href}
                className="flex items-center px-4 py-3 rounded-lg text-gray-800 hover:bg-gray-200 transition-colors font-medium"
              >
                {menu.icon}
                {menu.name}
              </a>
            ))}
          </nav>
          <div className="mt-8">
            <button className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-colors font-semibold">
              <LogIn className="w-5 h-5" /> 로그인
            </button>
          </div>
        </aside>
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
                  <img
                    src={referenceImage}
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                    alt="참고 이미지"
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
              {loading ? "영상 생성 중..." : "영상 제작"}
            </button>
            {error && <div className="text-red-500 text-sm mt-4">{error}</div>}
          </div>
        </section>
        {/* 결과 영역 */}
        <section className="flex flex-col justify-center items-center w-3/5 min-h-[calc(100vh-64px)] px-12">
          <div className="w-full max-w-[900px] rounded-2xl bg-[#f9f9fb] p-12 flex flex-col items-center" style={{ boxShadow: 'none', border: '1.5px solid #f3f4f6', minHeight: '600px' }}>
            <h3 className="text-xl font-semibold mb-8">이미지와 텍스트를 영상으로 생성</h3>
            
            {/* 미리보기 영상 컨테이너 - relative positioning */}
            <div className="relative w-[800px] h-[450px] mb-4">
              {/* 미리보기 영상 - 로딩 중이 아니고 생성된 영상이 없을 때만 표시 */}
              {!loading && !videoUrl && (
                <div className="w-full h-full flex items-center justify-center rounded-xl text-gray-400 text-xl bg-[#f5f6fa] relative overflow-hidden">
                  <video
                    src="/videos/preview-video.mp4"
                    className="w-full h-full object-cover rounded-xl"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                </div>
              )}
              
              {/* 로딩창 - 로딩 중일 때만 표시 */}
              {loading && (
                <div className="w-full h-full rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-dashed border-purple-200 flex flex-col items-center justify-center">
                  {/* 로딩 스피너 */}
                  <div className="relative mb-4">
                    <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin" style={{ animationDelay: '0.5s' }}></div>
                  </div>
                  
                  {/* 로딩 텍스트 */}
                  <div className="text-center">
                    <div className="text-purple-600 font-semibold text-xl mb-2">영상 생성 중...</div>
                    <div className="text-gray-500 text-sm">AI가 영상을 창작하고 있어요</div>
                  </div>
                  
                  {/* 진행 바 */}
                  <div className="w-64 h-2 bg-gray-200 rounded-full mt-6 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-500 to-blue-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              )}
              
              {/* 생성된 영상 - 로딩이 완료되고 영상이 있을 때만 표시 */}
              {!loading && videoUrl && (
                <div className="relative w-full h-full">
                  <video
                    src={videoUrl}
                    className="w-full h-full rounded-xl object-cover"
                    controls
                    loop
                    muted
                  />
                  
                  {/* 다운로드 버튼 */}
                  <button
                    className="absolute top-4 right-4 bg-white rounded-full p-3 shadow hover:bg-gray-100 transition-colors"
                    onClick={async () => {
                      try {
                        const response = await fetch(videoUrl);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `generated_video.mp4`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        console.error('다운로드 오류:', error);
                      }
                    }}
                    aria-label="영상 다운로드"
                  >
                    <Download className="w-6 h-6 text-gray-700" />
                  </button>
                </div>
              )}
            </div>
            
            {/* 생성 완료 메시지 */}
            {!loading && videoUrl && (
              <div className="text-center">
                <p className="text-gray-600 text-sm">영상이 성공적으로 생성되었습니다!</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
} 