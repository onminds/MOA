"use client";
import { useState } from "react";
import Header from '../components/Header';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';

import {
  Star
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const productivityTools = [
  // AI 글쓰기
  {
    id: 1,
    title: 'AI 완벽요약',
    description: '각종 콘텐츠를 AI로 완벽하게 요약합니다.',
    icon: '/images/productivity/ai-summary.png',
    favorite: false
  },



  {
    id: 2,
    title: 'AI 레포트 작성',
    description: '긴 글 작성을 AI로 쉽고 빠르게 완성합니다.',
    icon: '/images/productivity/report-writer.png',
    favorite: false
  },

  {
    id: 3,
    title: '자기소개서',
    description: '직무에 맞춘 자기소개서를 AI가 완성합니다.',
    icon: '/images/productivity/cover-letter.png',
    favorite: false
  },

  // AI 컨텐츠 제작

  {
    id: 4,
    title: '강의 녹음 노트',
    description: '음성을 녹음하면 AI가 실시간으로 요약합니다.',
    icon: '/images/productivity/lecture-notes.png',
    favorite: false
  },
  {
    id: 5,
    title: '면접 준비',
    description: 'AI와 함께 실제처럼 면접을 준비합니다.',
    icon: '/images/productivity/interview-prep.png',
    favorite: false
  },

  // AI 발표자료
  {
    id: 6,
    title: 'PPT 초안',
    description: 'PPT 목차와 초안을 AI가 자동으로 작성합니다.',
    icon: '/images/productivity/ppt-draft.png',
    favorite: false
  },
  {
    id: 7,
    title: '발표 대본',
    description: '주제에 맞춰 발표 대본을 AI가 완성합니다.',
    icon: '/images/productivity/presentation-script.png',
    favorite: false
  },

  // AI 코딩
  {
    id: 8,
    title: '코드 생성',
    description: '간단한 요구사항으로 코드를 자동 생성합니다.',
    icon: '/images/productivity/code-generate.png',
    favorite: false
  },
  {
    id: 9,
    title: '코드 리뷰',
    description: '작성된 코드를 AI가 분석하고 리뷰합니다.',
    icon: '/images/productivity/code-review.png',
    favorite: false
  },
];

const basicTools = [
  {
    id: 101,
    title: '이미지 생성',
    description: 'AI로 창의적인 이미지를 생성합니다.',
    icon: '/images/image-gen.jpg',
    path: '/image-create',
  },
  {
    id: 102,
    title: '비디오 생성',
    description: '텍스트로 동영상을 제작합니다.',
    icon: '/images/video-gen.mp4',
    path: '/video-create',
  }
];

export default function Productivity() {
  const [tools, setTools] = useState(productivityTools);
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useLanguage();

  const toggleFavorite = (id: number) => {
    setTools(tools.map(tool => 
      tool.id === id ? { ...tool, favorite: !tool.favorite } : tool
    ));
  };

  const handleToolClick = (toolId: number) => {
    // 로그인 체크
    if (!session) {
      alert(t('login_required') || '이 기능을 사용하려면 로그인이 필요합니다.');
      router.push('/auth/signin');
      return;
    }

    // AI 완벽요약 도구 클릭 시 해당 페이지로 이동
    if (toolId === 1) {
      router.push('/productivity/ai-summary');
    }

    // 자기소개서 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 3) {
      router.push('/productivity/cover-letter');
    }
    // 강의 녹음 노트 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 4) {
      router.push('/productivity/lecture-notes');
    }
    // 면접 준비 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 5) {
      router.push('/productivity/interview-prep');
    }
    // PPT 초안 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 6) {
      router.push('/ppt-template');
    }
    // 발표 대본 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 7) {
      router.push('/productivity/presentation-script');
    }
    // 코드 생성 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 8) {
      router.push('/productivity/code-generate');
    }
    // 코드 리뷰 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 9) {
      router.push('/productivity/code-review');
    }
    // AI 레포트 작성 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 2) {
      router.push('/productivity/report-writers');
    }
  };

  // 기본 도구 클릭 핸들러 (로그인 체크 포함)
  const handleBasicToolClick = (path: string) => {
    if (!session) {
      // 로그인이 필요하다는 알림
      alert(t('login_required') || '이 기능을 사용하려면 로그인이 필요합니다.');
      router.push('/auth/signin');
      return;
    }
    router.push(path);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* 메인 콘텐츠 */}
          <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">생산성 도구</h1>
                <p className="text-gray-600">AI를 활용한 다양한 생산성 도구들을 활용해보세요</p>
              </div>

              {/* 도구 목록 */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  모든 도구
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tools.map((tool) => (
                    <div
                      key={tool.id}
                      className={'bg-white rounded-xl p-6 border border-black hover:shadow-lg transition-all duration-300 ease-in-out hover:-translate-y-1 hover:scale-[1.03] active:scale-[0.98] cursor-pointer relative'}
                      onClick={() => handleToolClick(tool.id)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(tool.id);
                        }}
                        className={`absolute top-4 right-4 text-gray-400 hover:text-yellow-500 transition-colors`}
                      >
                        <Star className={`w-5 h-5 ${tool.favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </button>
                      <div className="flex flex-col items-center text-center">
                        <div className="p-4 rounded-lg bg-white mb-2">
                          <img src={tool.icon} alt={tool.title} className="w-16 h-16 object-cover" />
                        </div>
                        <h3 className={`text-xl font-semibold mb-2 text-gray-900`}>{tool.title}</h3>
                        <p className={`text-base h-12 text-gray-600`}>{tool.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="my-12 border-gray-300" />

              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  기본 도구
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {basicTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="bg-white rounded-xl p-6 border border-black hover:shadow-lg transition-all duration-300 ease-in-out hover:-translate-y-1 hover:scale-[1.03] active:scale-[0.98] cursor-pointer relative"
                      onClick={() => handleBasicToolClick(tool.path)}
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="p-4 rounded-lg bg-white mb-2">
                          <img src={tool.icon} alt={tool.title} className="w-16 h-16 object-cover" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{tool.title}</h3>
                        <p className="text-base text-gray-600 h-12">{tool.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}