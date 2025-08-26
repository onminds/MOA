'use client';

import { useEffect } from 'react';

export default function TemplateGalleryPage() {
	useEffect(() => {
		document.title = 'PPT 템플릿 선택';
	}, []);

	const selectTemplate = (tpl: 'Modern company' | 'Clinique Slide') => {
		try {
			window.localStorage.setItem('ppt_template_set', tpl);
			// 템플릿 선택 후, 본 생성 페이지를 새 창으로 띄우거나 현재 창 전환
			// 여기서는 본 창을 닫고(갤러리), 부모 창에서 생성 버튼을 눌러 이어가도록 함
			window.close();
		} catch {}
	};

	return (
		<div className="min-h-screen bg-white">
			<div className="mx-auto max-w-5xl p-6">
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-2xl font-semibold text-gray-900">템플릿 갤러리</h1>
					<button onClick={() => window.close()} className="text-sm text-gray-500 hover:text-gray-700">닫기</button>
				</div>
				<p className="text-gray-600 mb-6">원하는 템플릿을 선택하세요. 선택 즉시 적용되며 이 창은 닫힙니다.</p>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
					<button onClick={() => selectTemplate('Modern company')} className="group relative rounded-xl overflow-hidden border shadow hover:shadow-md transition">
						<div className="aspect-[16/9] bg-gradient-to-br from-blue-900 to-indigo-700 flex items-end p-5">
							<div className="text-left">
								<div className="text-xs text-blue-200 mb-1">템플릿 세트</div>
								<div className="text-white text-xl font-semibold">Modern company</div>
								<div className="text-blue-200 text-sm mt-1">모던한 기업형 스타일</div>
							</div>
						</div>
					</button>

					<button onClick={() => selectTemplate('Clinique Slide')} className="group relative rounded-xl overflow-hidden border shadow hover:shadow-md transition">
						<div className="aspect-[16/9] bg-gradient-to-br from-teal-600 to-emerald-500 flex items-end p-5">
							<div className="text-left">
								<div className="text-xs text-emerald-100 mb-1">템플릿 세트</div>
								<div className="text-white text-xl font-semibold">Clinique Slide</div>
								<div className="text-emerald-100 text-sm mt-1">클린 & 미니멀 스타일</div>
							</div>
						</div>
					</button>
				</div>

				<div className="mt-6 text-sm text-gray-500">선택 후 본 창을 닫고, 생성 화면에서 "12페이지 PPT 생성하기"를 눌러 진행하세요.</div>
			</div>
		</div>
	);
}
