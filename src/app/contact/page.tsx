"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Mail, ChevronDown } from 'lucide-react';
import Header from '@/app/components/Header';

// 테스트용 FAQ 데이터
const faqData = [
  {
    question: "무료 플랜과 유료 플랜의 차이점은 무엇인가요?",
    answer: "무료 플랜은 기본적인 AI 도구 검색 및 일부 기능 사용이 가능합니다. 유료 플랜(Standard, Pro)으로 업그레이드하시면 더 많은 고급 기능, 이미지/비디오 생성 크레딧, 빠른 지원 등 다양한 혜택을 받으실 수 있습니다. 자세한 내용은 플랜 페이지를 참고해주세요.",
  },
  {
    question: "MOA 서비스는 어떻게 사용하나요?",
    answer: "MOA 서비스는 다양한 AI 기능을 제공하여 사용자의 생산성을 높여줍니다. 원하는 기능을 선택하여 사용해보세요!",
  },
  {
    question: "플랜 변경은 어떻게 하나요?",
    answer: "플랜 페이지로 이동하여 원하시는 플랜을 선택하고 변경할 수 있습니다. 변경 사항은 즉시 적용됩니다.",
  },
];



export default function ContactPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (session?.user) {
      setFormData(prev => ({
        ...prev,
        name: session.user.name || '',
        email: session.user.email || '',
      }));
    }
  }, [session]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const handleFaqToggle = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus('메시지를 보내는 중입니다...');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const resData = await res.json();

      if (res.ok) {
        setStatus('메시지가 성공적으로 전송되었습니다.');
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        setStatus(`전송 실패: ${resData.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('Contact form submission error:', error);
      setStatus('네트워크 오류가 발생했습니다. 나중에 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen">
        <Header forceWhiteBackground={true} />
        <main className="grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-4rem)]">
            {/* Left Column */}
            <div className="bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-center">
                <div className="max-w-lg w-full">
                    <div className="text-left">
                        <div className="flex items-center">
                            <Mail className="w-12 h-12 text-indigo-600 mr-5 flex-shrink-0" />
                            <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">
                            문의하기
                            </h1>
                        </div>
                        <p className="mt-6 text-lg text-gray-600">
                        저희에게 연락해주셔서 감사합니다. 궁금한 점이 있으시면 언제든지 문의해주세요.
                        </p>
                        <p className="mt-2 text-base text-gray-500">
                        보통 24시간 이내에 답변해드립니다.
                        </p>

                        {/* FAQ Section */}
                        <div className="mt-12 pt-10 border-t border-gray-200">
                        <h2 className="text-2xl font-bold text-gray-900">자주 묻는 질문 (FAQ)</h2>
                        <div className="mt-6 space-y-4">
                            {faqData.map((faq, index) => (
                            <div key={index} className="bg-white rounded-lg shadow-sm border border-indigo-200 overflow-hidden transition-all duration-300">
                                <button
                                    onClick={() => handleFaqToggle(index)}
                                    className="w-full flex justify-between items-center text-left py-4 px-5 hover:bg-gray-50 focus:outline-none"
                                >
                                    <span className="text-lg font-medium text-gray-900">{faq.question}</span>
                                    <ChevronDown
                                        className={`w-5 h-5 transition-transform duration-300 text-gray-500 ${openFaqIndex === index ? 'rotate-180 text-indigo-600' : ''}`}
                                    />
                                </button>
                                {openFaqIndex === index && (
                                    <div className="px-5 pb-4 text-base text-gray-700 animate-fade-in-down">
                                        <div className="border-t border-gray-200 pt-4 mt-1">
                                            <p>{faq.answer}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            ))}
                        </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column with Contact Form */}
            <div className="relative md:sticky top-0 h-screen md:h-auto">
              <div className="relative z-10 py-12 px-4 sm:px-6 lg:px-8 xl:px-12 flex items-center justify-center min-h-full">
                  <div className="relative w-full max-w-lg bg-white/90 backdrop-blur-md p-8 sm:p-10 rounded-2xl shadow-xl border border-white/30">
                      <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-y-6 gap-x-8 sm:grid-cols-2">
                        <div>
                            <label htmlFor="name" className="block text-sm font-semibold leading-6 text-gray-900">이름</label>
                            <div className="mt-2.5">
                            <input type="text" id="name" name="name" autoComplete="name" value={formData.name} onChange={handleChange} required className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-semibold leading-6 text-gray-900">이메일</label>
                            <div className="mt-2.5">
                            <input type="email" id="email" name="email" autoComplete="email" value={formData.email} onChange={handleChange} required className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                            </div>
                        </div>
                        </div>
                        <div>
                        <label htmlFor="subject" className="block text-sm font-semibold leading-6 text-gray-900">제목</label>
                        <div className="mt-2.5">
                            <input type="text" id="subject" name="subject" value={formData.subject} onChange={handleChange} required className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6" />
                        </div>
                        </div>
                        <div>
                        <label htmlFor="message" className="block text-sm font-semibold leading-6 text-gray-900">메시지</label>
                        <div className="mt-2.5">
                            <textarea id="message" name="message" rows={11} value={formData.message} onChange={handleChange} required className="block w-full rounded-md border-0 px-3.5 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"></textarea>
                        </div>
                        </div>
                        <div className="pt-4">
                        <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 border border-transparent rounded-md py-3 px-5 flex items-center justify-center text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors duration-200">
                            {isLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />메시지 보내는 중...</>) : '메시지 보내기'}
                        </button>
                        </div>
                    </form>
                    {status && (<div className="mt-6 text-center"><p className={`text-sm ${status.includes('성공') ? 'text-green-600' : 'text-red-600'}`}>{status}</p></div>)}
                </div>
            </div>
          </div>
        </main>
    </div>
    </>
  );
}

