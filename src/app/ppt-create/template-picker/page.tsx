'use client';

import { useEffect, useState } from 'react';

export default function TemplatePickerPage() {
	const [selected, setSelected] = useState<'Modern company' | 'Clinique Slide'>(() => {
		if (typeof window !== 'undefined') {
			const saved = window.localStorage.getItem('ppt_template_set');
			if (saved === 'Clinique Slide' || saved === 'Modern company') return saved as any;
		}
		return 'Modern company';
	});

	useEffect(() => {
		document.title = '템플릿 선택';
	}, []);

	const saveAndClose = () => {
		try {
			window.localStorage.setItem('ppt_template_set', selected);
			window.close();
		} catch {}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
			<div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
				<h1 className="text-2xl font-semibold text-gray-800 mb-4">템플릿 세트 선택</h1>
				<p className="text-gray-600 text-sm mb-6">원하는 템플릿 세트를 선택한 뒤 저장을 누르세요. 선택은 본 창을 닫으면 적용됩니다.</p>
				<div className="space-y-3">
					<label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
						<input
							type="radio"
							name="tpl"
							checked={selected === 'Modern company'}
							onChange={() => setSelected('Modern company')}
							className="h-4 w-4"
						/>
						<span className="font-medium text-gray-800">Modern company</span>
					</label>
					<label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
						<input
							type="radio"
							name="tpl"
							checked={selected === 'Clinique Slide'}
							onChange={() => setSelected('Clinique Slide')}
							className="h-4 w-4"
						/>
						<span className="font-medium text-gray-800">Clinique Slide</span>
					</label>
				</div>
				<div className="mt-6 flex gap-3 justify-end">
					<button
						className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
						onClick={() => window.close()}
					>
						취소
					</button>
					<button
						className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
						onClick={saveAndClose}
					>
						저장
					</button>
				</div>
			</div>
		</div>
	);
}
