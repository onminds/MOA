"use client";
import { useState } from "react";
import Header from '../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, LogIn, Download, X
} from 'lucide-react';
import Image from 'next/image';

const STYLES = [
  { name: '원본', suffix: '', example: '/images/original.jpg' },
  { name: '일러스트', suffix: '일러스트 스타일로', example: '/images/illustration.jpg' },
  { name: '유화', suffix: '유화 스타일로', example: '/images/oil.jpg' },
  { name: '3D', suffix: '3D 스타일로', example: '/images/3d.jpg' },
];

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

export default function ImageCreate() {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
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
    setImages([null, null, null, null]);
    try {
      const results = await Promise.all(
        STYLES.map(async (style) => {
          const formData = new FormData();
          formData.append('prompt', prompt + (style.suffix ? `, ${style.suffix}` : ""));
          formData.append('ratio', ratio);
          if (referenceImageFile) {
            formData.append('referenceImage', referenceImageFile);
          }

          const res = await fetch("/api/image-generate", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          return data.url || null;
        })
      );
      setImages(results);
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
            <h2 className="text-2xl font-bold mb-8">이미지 제작</h2>
            <label className="font-semibold mb-1">이미지 설명 <span className="text-blue-500">*</span></label>
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
                    className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                  />
                  <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs px-1 rounded-full">
                    첨부됨
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  참고 이미지의 스타일이 생성 결과에 반영됩니다.
                </div>
                <div className="mt-1 text-xs text-blue-500">
                  💡 팁: 참고 이미지의 아트 스타일, 색감, 구도가 새 이미지에 적용됩니다.
                </div>
              </div>
            )}
            
            <label className="font-semibold mb-1 mt-2">가로 세로 비율 <span className="text-blue-500">*</span></label>
            <div className="flex gap-4 mb-6">
              <button
                className={`flex-1 py-2 rounded-lg border ${ratio === "1:1" ? "bg-black text-white border-black" : "bg-white text-gray-800 border-gray-200"}`}
                onClick={() => setRatio("1:1")}
                disabled={loading}
              >
                1:1
              </button>
              <button
                className={`flex-1 py-2 rounded-lg border ${ratio === "16:9" ? "bg-black text-white border-black" : "bg-white text-gray-800 border-gray-200"}`}
                onClick={() => setRatio("16:9")}
                disabled={loading}
              >
                16:9
              </button>
            </div>
            <button
              className="w-full py-3 rounded-xl bg-black text-white font-bold text-lg shadow hover:bg-gray-800 transition-colors disabled:bg-gray-300"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
            >
              {loading ? "이미지 생성 중..." : "이미지 제작"}
            </button>
            {error && <div className="text-red-500 text-sm mt-4">{error}</div>}
          </div>
        </section>
        {/* 결과 영역 */}
        <section className="flex flex-col justify-center items-center w-3/5 min-h-[calc(100vh-64px)] px-12">
          <div className="w-full max-w-4xl rounded-2xl bg-[#f9f9fb] p-12 flex flex-col items-center" style={{ boxShadow: 'none', border: '1.5px solid #f3f4f6', height: 888 }}>
            <div className="grid grid-cols-2 gap-8">
              {STYLES.map((style, idx) => (
                <div className="w-full max-w-md rounded-2xl bg-[#f9f9fb] p-8 flex flex-col items-center relative" style={{ boxShadow: 'none', border: '1.5px solid #f3f4f6', height: 380 }} key={style.name}>
                  {/* 미리보기 이미지 - 항상 표시 */}
                  <div className="w-[300px] h-[300px] flex items-center justify-center rounded-xl text-gray-400 text-xl bg-[#f5f6fa] relative overflow-hidden mb-2">
                    <Image
                      src={style.example}
                      alt={style.name + " 예시"}
                      width={300}
                      height={300}
                      className="w-full h-full object-cover rounded-xl"
                      onError={(e) => {
                        // 이미지 로드 실패 시 기본 텍스트 표시
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const fallback = target.parentElement?.querySelector('.image-fallback');
                        if (fallback) {
                          fallback.classList.remove('hidden');
                        }
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xl bg-[#f5f6fa] bg-opacity-70 hidden image-fallback">
                      {style.name} 미리보기
                    </div>
                  </div>
                  
                  {/* 생성된 이미지 또는 로딩 - 있을 때만 표시 */}
                  {(images[idx] || loading) && (
                    <div className="relative">
                      {loading ? (
                        <div className="w-[300px] h-[300px] rounded-xl bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-dashed border-blue-200 flex flex-col items-center justify-center mb-2">
                          {/* 로딩 스피너 */}
                          <div className="relative mb-4">
                            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-purple-600 rounded-full animate-spin" style={{ animationDelay: '0.5s' }}></div>
                          </div>
                          
                          {/* 로딩 텍스트 */}
                          <div className="text-center">
                            <div className="text-blue-600 font-semibold text-lg mb-1">{style.name} 생성 중...</div>
                            <div className="text-gray-500 text-sm">AI가 창작하고 있어요</div>
                          </div>
                          
                          {/* 진행 바 */}
                          <div className="w-48 h-1 bg-gray-200 rounded-full mt-4 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <Image
                            src={images[idx] as string}
                            alt={style.name + " 생성된 이미지"}
                            width={ratio === "1:1" ? 300 : 400}
                            height={300}
                            className="rounded-xl object-cover mb-2"
                            style={{ background: '#f3f4f6' }}
                            onError={(e) => {
                              console.error('생성된 이미지 로드 실패:', images[idx]);
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const fallback = target.parentElement?.querySelector('.generated-image-fallback');
                              if (fallback) {
                                fallback.classList.remove('hidden');
                              }
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xl bg-[#f5f6fa] bg-opacity-70 hidden generated-image-fallback">
                            이미지 로드 실패
                          </div>
                        </div>
                      )}
                      
                      {/* 다운로드 버튼 - 생성 완료 시에만 표시 */}
                      {images[idx] && !loading && (
                        <button
                          className="absolute top-4 right-4 bg-white rounded-full p-2 shadow hover:bg-gray-100 transition-colors"
                          onClick={async () => {
                            try {
                              // 프록시 API를 통해 이미지 다운로드
                              const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(images[idx] as string)}`;
                              const response = await fetch(proxyUrl);
                              
                              if (response.ok) {
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `${style.name}_image.png`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                              } else {
                                console.error('다운로드 실패');
                              }
                            } catch (error) {
                              console.error('다운로드 오류:', error);
                            }
                          }}
                          aria-label="이미지 다운로드"
                        >
                          <Download className="w-5 h-5 text-gray-700" />
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="font-semibold text-center mb-2">{style.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
} 