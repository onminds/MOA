'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

export default function PPTTemplateSelectPage() {
	const router = useRouter();
	const [selected, setSelected] = useState<'Modern company' | 'Clinique Slide'>(() => {
		if (typeof window !== 'undefined') {
			const saved = window.localStorage.getItem('ppt_template_set');
			if (saved === 'Clinique Slide' || saved === 'Modern company') return saved as any;
		}
		return 'Modern company';
	});

	// 미리보기 모달 상태
	const [showPreview, setShowPreview] = useState(false);
	const [previewHtml, setPreviewHtml] = useState('');
	const [previewTitle, setPreviewTitle] = useState('');
	const [previewSlides, setPreviewSlides] = useState<string[]>([]);
	const [currentSlide, setCurrentSlide] = useState(0);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [customHtml, setCustomHtml] = useState('');
	const [isLoadingImages, setIsLoadingImages] = useState(false);
	const thumbsRef = useRef<HTMLDivElement>(null);
	const scrollThumbs = (dir: 'left' | 'right') => {
		const el = thumbsRef.current;
		if (!el) return;
		const amount = el.clientWidth * 0.9; // 한 화면 정도
		el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
	};

	// 메인 프리뷰 이미지 로딩 실패 시 iframe으로 폴백
	const [mainImgFailed, setMainImgFailed] = useState(false);
	useEffect(() => {
		setMainImgFailed(false);
	}, [previewHtml]);

	const openPreview = async (tpl: 'Modern company' | 'Clinique Slide') => {
		setPreviewTitle(tpl);
		setCustomHtml('');
		setIsLoadingImages(true);
		
		// 먼저 이미지 슬라이드를 로드 시도
		try {
			const folder = (tpl === 'Modern company') ? 'modern-company' : 'clinique-slide';
			const base = `/images/templates/${folder}`;
			console.log('[템플릿 이미지 로드]', { folder, base });
			const exts = ['jpg','png','jpeg','webp'];
			const maxSlides = 12;
			const foundHtmls: string[] = [];
			
			for (let i = 1; i <= maxSlides; i++) {
				let foundForIndex = false;
				for (const ext of exts) {
					const url = `${base}/${i}.${ext}`;
					console.log('check', url);
					// eslint-disable-next-line no-await-in-loop
					const ok = await checkImageExists(url);
					if (ok) {
						foundHtmls.push(buildImageHtml(url));
						foundForIndex = true;
						break;
					}
				}
				if (!foundForIndex) {
					// 없으면 건너뜀 (빈 슬롯 허용)
				}
			}
			
			// 이미지가 있으면 이미지 슬라이드 사용
			if (foundHtmls.length > 0) {
				setPreviewSlides(foundHtmls);
				setCurrentSlide(0);
				setPreviewHtml(foundHtmls[0]);
				setShowPreview(true);
				setIsLoadingImages(false);
				return;
			}
		} catch (error) {
			console.warn('이미지 로드 실패:', error);
		}
		
		// 이미지가 없으면 기본 HTML 슬라이드 사용
		const modernHtml = `
		  <div style="width:1280px;height:720px;background:linear-gradient(135deg,#1e3a8a,#4338ca);color:#fff;font-family:Inter,Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;">
		    <div style="opacity:.9;font-size:18px;margin-bottom:8px">Modern company</div>
		    <div style="font-size:48px;font-weight:800;letter-spacing:.2px;margin-bottom:12px;text-align:center">모던 기업 프레젠테이션</div>
		    <div style="font-size:18px;opacity:.9;text-align:center">신뢰감 있는 블루 톤 · 그래프/표 강조 레이아웃</div>
		  </div>`;

		const modernHtml2 = `
		  <div style=\"width:1280px;height:720px;background:white;color:#0f172a;font-family:Inter,Arial,Helvetica,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;\">\n            <div style=\"font-size:44px;font-weight:800;margin-bottom:16px;\">데이터 기반 인사이트</div>\n            <div style=\"display:flex;gap:24px;\">\n              <div style=\"width:460px;height:260px;background:linear-gradient(135deg,#1e3a8a,#4338ca);border-radius:12px;\"></div>\n              <div style=\"width:460px;height:260px;background:#e2e8f0;border-radius:12px;\"></div>\n            </div>\n          </div>`;

		const cliniqueHtml = `
		  <div style=\"width:1280px;height:720px;background:linear-gradient(135deg,#059669,#14b8a6);color:#fff;font-family:Inter,Arial,Helvetica,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;\">\n            <div style=\"opacity:.9;font-size:18px;margin-bottom:8px\">Clinique Slide</div>\n            <div style=\"font-size:48px;font-weight:800;letter-spacing:.2px;margin-bottom:12px;text-align:center\">클린 & 미니멀 스타일</div>\n            <div style=\"font-size:18px;opacity:.9;text-align:center\">여백 중심 · 타이포 강조 · 심플한 아이콘</div>\n          </div>`;

		const cliniqueHtml2 = `
		  <div style=\"width:1280px;height:720px;background:white;color:#0f172a;font-family:Inter,Arial,Helvetica,sans-serif;display:flex;flex-direction:column;justify-content:center;align-items:center;\">\n            <div style=\"font-size:44px;font-weight:800;margin-bottom:16px;\">심플 레이아웃</div>\n            <div style=\"display:flex;gap:24px;\">\n              <div style=\"width:460px;height:260px;background:linear-gradient(135deg,#059669,#14b8a6);border-radius:12px;\"></div>\n              <div style=\"width:460px;height:260px;background:#e2e8f0;border-radius:12px;\"></div>\n            </div>\n          </div>`;

		const baseSlides = tpl === 'Modern company' ? [modernHtml, modernHtml2] : [cliniqueHtml, cliniqueHtml2];
		setPreviewSlides(baseSlides);
		setCurrentSlide(0);
		setPreviewHtml(baseSlides[0]);
		setShowPreview(true);
		setIsLoadingImages(false);
		
		console.warn('이미지 파일을 찾지 못했습니다.');
		alert('이미지 파일을 찾지 못했습니다. public/images/templates/<modern-company|clinique-slide>/1~12.(jpg|png|jpeg|webp) 경로를 확인해주세요.');
	};

	const closePreview = () => setShowPreview(false);

	const applyCustomHtml = () => {
		if (!customHtml.trim()) return;
		setPreviewHtml(customHtml);
	};

	const resetPreviewToDefault = () => {
		openPreview(previewTitle as any);
	};

	// 이미지 슬라이드 로더: public/images/templates/<folder>/<1..12>.(jpg|png|jpeg|webp)
	const checkImageExists = async (url: string) => {
		try {
			const res = await fetch(url, { method: 'GET', cache: 'no-store' });
			return res.ok;
		} catch {
			return false;
		}
	};

	const buildImageHtml = (url: string) => `
		<div style="width:1280px;height:720px;display:flex;align-items:center;justify-content:center;background:white;overflow:hidden;">
			<img src="${url}" style="width:100%;height:100%;object-fit:cover"/>
		</div>
	`;



	// 이미지 HTML에서 원본 src 추출 (이미지 프리뷰를 선명하게 렌더링하기 위함)
	const extractImageSrc = (html: string): string | null => {
		const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
		return match ? match[1] : null;
	};

	useEffect(() => {
		// 초안에서 새로 시작하면 이전 선택을 초기화했으므로 여기서는 항상 선택 페이지를 보여줍니다.
	}, []);

	const goNext = () => {
		window.localStorage.setItem('ppt_template_set', selected);
		router.push('/ppt-create');
	};

	return (
		<div className="min-h-screen bg-white">
			<Header />
			{/* 왼쪽 위 이전 버튼 */}
			<button 
				onClick={() => router.push('/productivity')} 
				className="fixed top-20 left-4 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-all text-gray-700 hover:text-gray-900 text-sm font-medium"
			>
				<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				뒤로
			</button>
			<div className="mx-auto max-w-7xl px-4 lg:px-0 py-8 min-h-[calc(100vh-64px)] flex items-center justify-center">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-y-10 gap-x-20 lg:gap-x-32 items-center mx-auto w-full">
					{/* 왼쪽: 설명 및 액션 버튼 */}
					<div className="self-center text-center">
						<div className="mb-8">
							<h1 className="text-4xl lg:text-4xl font-bold text-gray-900">원하는 템플릿을 선택해주세요!</h1>
						</div>
						

						<div className="mt-8 flex justify-center">
							<button onClick={goNext} className="px-16 py-4 rounded-lg bg-black text-white hover:bg-gray-800 font-semibold text-lg min-w-[200px]">다음: 제작</button>
						</div>
					</div>

					{/* 오른쪽: 템플릿 카드 - 2열로 좌우 배치 */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-4xl">
						<label className={`group relative rounded-xl overflow-hidden border shadow hover:shadow-md transition cursor-pointer ${selected==='Modern company'?'ring-2 ring-blue-500':''}`}>
							<input type="radio" name="tpl" className="sr-only" checked={selected==='Modern company'} onChange={() => setSelected('Modern company')} />
							<div className="aspect-[16/9] relative bg-gray-100">
								<img 
									src="/images/templates/modern-company/1.jpg" 
									alt="Modern company template preview"
									className="w-full h-full object-cover"
									onError={(e) => {
										// JPG 실패시 PNG 시도
										const target = e.target as HTMLImageElement;
										if (target.src.includes('.jpg')) {
											target.src = '/images/templates/modern-company/1.png';
											return;
										}
										// PNG도 실패시 JPEG 시도
										if (target.src.includes('.png')) {
											target.src = '/images/templates/modern-company/1.jpeg';
											return;
										}
										// JPEG도 실패시 WEBP 시도
										if (target.src.includes('.jpeg')) {
											target.src = '/images/templates/modern-company/1.webp';
											return;
										}
										// 모든 확장자 실패시 기본 그라디언트로 폴백
										target.style.display = 'none';
										const parent = target.parentElement;
										if (parent) {
											parent.style.background = 'linear-gradient(135deg, #1e3a8a, #4338ca)';
										}
									}}
								/>

							</div>
							<button
								onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPreview('Modern company'); }}
								className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-white/90 text-gray-800 hover:bg-white shadow"
							>
								미리보기
							</button>
						</label>

						<label className={`group relative rounded-xl overflow-hidden border shadow hover:shadow-md transition cursor-pointer ${selected==='Clinique Slide'?'ring-2 ring-emerald-500':''}`}>
							<input type="radio" name="tpl" className="sr-only" checked={selected==='Clinique Slide'} onChange={() => setSelected('Clinique Slide')} />
							<div className="aspect-[16/9] relative bg-gray-100">
								<img 
									src="/images/templates/clinique-slide/1.png" 
									alt="Clinique Slide template preview"
									className="w-full h-full object-cover"
									onError={(e) => {
										// PNG 실패시 JPG 시도
										const target = e.target as HTMLImageElement;
										if (target.src.includes('.png')) {
											target.src = '/images/templates/clinique-slide/1.jpg';
											return;
										}
										// JPG도 실패시 JPEG 시도
										if (target.src.includes('.jpg')) {
											target.src = '/images/templates/clinique-slide/1.jpeg';
											return;
										}
										// JPEG도 실패시 WEBP 시도
										if (target.src.includes('.jpeg')) {
											target.src = '/images/templates/clinique-slide/1.webp';
											return;
										}
										// 모든 확장자 실패시 기본 그라디언트로 폴백
										target.style.display = 'none';
										const parent = target.parentElement;
										if (parent) {
											parent.style.background = 'linear-gradient(135deg, #059669, #14b8a6)';
										}
									}}
								/>

							</div>
							<button
								onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPreview('Clinique Slide'); }}
								className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-white/90 text-gray-800 hover:bg-white shadow"
							>
								미리보기
							</button>
						</label>
					</div>

					{/* 미리보기 모달 */}
					{showPreview && (
						<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={closePreview}>
							<div className="bg-white rounded-xl shadow-2xl w-full max-w-[1160px] max-h-[92vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
								<div className="flex items-center justify-between px-4 py-3 border-b">
									<h3 className="text-lg font-semibold text-gray-900">템플릿 세부 정보</h3>
									<button onClick={closePreview} className="px-3 py-1 rounded border text-gray-700 hover:bg-gray-50">닫기</button>
								</div>
								<div className="flex items-start gap-4 p-4">
									{/* 왼쪽: 큰 미리보기 + 썸네일 */}
									<div className="flex-1">
										<div className="bg-gray-100 rounded-lg border p-3 mb-3 flex items-center justify-center min-h-[300px]">
											{isLoadingImages ? (
												<div className="flex flex-col items-center justify-center">
													<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
													<div className="text-sm text-gray-600">템플릿 이미지를 불러오는 중...</div>
												</div>
											) : (
												<div className="inline-block border rounded overflow-hidden" style={{ width: '720px', height: '405px', background: 'white' }}>
													<iframe srcDoc={previewHtml} title="template-preview" scrolling="no" style={{ border: 'none', width: '1280px', height: '720px', transform: 'scale(0.5625)', transformOrigin: 'top left' }} />
												</div>
											)}
										</div>
										{!isLoadingImages && (
											<div className="relative max-w-[720px]">
												<button onClick={() => scrollThumbs('left')} className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 bg-white border rounded-full w-8 h-8 shadow hover:bg-gray-50">‹</button>
												<div ref={thumbsRef} className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
													{previewSlides.map((slide, i) => (
														<button 
															key={i} 
															onClick={(e) => { 
																e.preventDefault(); 
																e.stopPropagation(); 
																console.log('썸네일 클릭:', i); 
																setCurrentSlide(i); 
																setPreviewHtml(slide); 
															}} 
															className={`relative border rounded hover:shadow shrink-0 cursor-pointer ${currentSlide===i? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-gray-300'}`}
															style={{ minWidth: '150px', minHeight: '84px' }}
														>
															<div className="bg-white overflow-hidden pointer-events-none" style={{ width: '150px', height: '84px' }}>
																<iframe srcDoc={slide} title={`thumb-${i}`} scrolling="no" style={{ border: 'none', width: '1280px', height: '720px', transform: 'scale(0.117)', transformOrigin: 'top left', pointerEvents: 'none' }} />
															</div>
														</button>
													))}
												</div>
												<button onClick={() => scrollThumbs('right')} className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 bg-white border rounded-full w-8 h-8 shadow hover:bg-gray-50">›</button>
											</div>
										)}
									</div>

									{/* 오른쪽: 설명 및 액션 */}
									<div className="w-[320px] shrink-0">
										<div className="text-sm text-gray-500 mb-4">1280 x 720</div>
										<div className="text-xl font-bold text-gray-900 mb-2">{previewTitle === 'Modern company' ? '현대 기업 고객 경험 프레젠테이션' : '클린 & 미니멀 프레젠테이션'}</div>
										<p className="text-gray-600 text-sm leading-6 mb-3">
											{previewTitle === 'Modern company'
												? '경영진 보고나 비즈니스 컨텍스트에 적합한 신뢰감 있는 블루 톤과 데이터 시각화 중심의 모던 기업형 템플릿입니다.'
												: '여백과 타이포그래피를 강조한 클린 & 미니멀 스타일. 핵심 메시지를 또렷하게 전달하기 좋습니다.'}
										</p>
										<div className="flex flex-wrap gap-2 mb-5">
											{(previewTitle === 'Modern company' ? ['비즈니스','데이터','신뢰감','블루톤','모던'] : ['미니멀','모던','여백','그린톤','클린']).map(tag => (
												<span key={tag} className="px-2 py-1 rounded-full text-xs border bg-gray-50 text-gray-700">{tag}</span>
											))}
										</div>

										{/* 고정 12슬롯 갤러리를 사용하므로 별도 버튼 제거 */}

										<button onClick={() => { setSelected(previewTitle as any); window.localStorage.setItem('ppt_template_set', previewTitle as any); router.push('/ppt-create'); }} className="w-full py-3 rounded bg-black text-white hover:bg-gray-900">이 템플릿 사용하기</button>

										<div className="mt-4">
											<button onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm text-gray-600 underline">고급: 사용자 HTML 적용</button>
											{showAdvanced && (
												<div className="mt-2">
													<textarea value={customHtml} onChange={(e) => setCustomHtml(e.target.value)} placeholder="여기에 템플릿 첫 페이지 HTML을 붙여넣으세요" className="w-full h-28 p-2 border rounded" />
													<div className="mt-2 flex gap-2">
														<button onClick={() => { if (!customHtml.trim()) return; setPreviewHtml(customHtml); setPreviewSlides([customHtml, ...previewSlides.slice(1)]); }} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">HTML 적용</button>
														<button onClick={() => { openPreview(previewTitle as any); }} className="px-3 py-1 rounded border text-sm">기본 디자인으로</button>
													</div>
												</div>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}


