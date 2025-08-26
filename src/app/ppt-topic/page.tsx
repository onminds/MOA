'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PPTTopicPage() {
	const router = useRouter();
	const [topic, setTopic] = useState('');

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const tpl = window.localStorage.getItem('ppt_template_set');
		if (!tpl) {
			router.replace('/ppt-template');
			return;
		}
		const saved = window.localStorage.getItem('ppt_topic');
		if (saved) setTopic(saved);
	}, [router]);

	const goNext = () => {
		if (!topic.trim()) {
			alert('주제를 입력해주세요.');
			return;
		}
		window.localStorage.setItem('ppt_topic', topic.trim());
		router.push('/ppt-create');
	};

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
			<div className="container mx-auto px-0 py-8 max-w-3xl">
				<h1 className="text-4xl font-bold text-gray-800 mb-6">주제 입력</h1>
				<p className="text-gray-600 mb-6">선택한 템플릿에 맞춰 생성할 주제를 입력하세요.</p>
				<div className="bg-white rounded-2xl shadow-xl p-8">
					<label className="block text-sm font-medium text-gray-700 mb-2">주제 *</label>
					<textarea
						value={topic}
						onChange={(e) => setTopic(e.target.value)}
						placeholder="예: AI의 미래, 기업 디지털 전환, 환경 보호 등"
						className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
						rows={4}
					/>
					<div className="mt-6 flex justify-between">
						<button onClick={() => router.push('/productivity')} className="px-6 py-3 rounded-lg border text-gray-700 hover:bg-gray-50">이전</button>
						<button onClick={goNext} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">다음: 제작</button>
					</div>
				</div>
			</div>
		</div>
	);
}
