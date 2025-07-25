"use client";
import { useState } from "react";
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import {
  FileText, Presentation, Code, Star, Briefcase, FileVideo, MessageSquare, Newspaper
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const categories = [
  {
    id: 'writing',
    name: 'AI 글쓰기',
    description: '요약, 이메일, 레포트, 블로그, 자기소개서 등',
    icon: <FileText className="w-8 h-8" />,
    iconBg: 'bg-blue-500',
    toolCount: 5
  },
  {
    id: 'content',
    name: 'AI 컨텐츠 제작',
    description: 'SNS 게시물, 강의 녹음 노트, 면접 준비 등',
    icon: <MessageSquare className="w-8 h-8" />,
    iconBg: 'bg-purple-500',
    toolCount: 3
  },
  {
    id: 'presentation',
    name: 'AI 발표자료',
    description: 'PPT 초안, 발표 대본 등',
    icon: <Presentation className="w-8 h-8" />,
    iconBg: 'bg-green-500',
    toolCount: 2
  },
  {
    id: 'coding',
    name: 'AI 코딩',
    description: '코드 생성, 코드 리뷰 등',
    icon: <Code className="w-8 h-8" />,
    iconBg: 'bg-orange-500',
    toolCount: 2
  },
];

const productivityTools = [
  // AI 글쓰기
  {
    id: 1,
    title: 'AI 완벽요약',
    description: 'YouTube, 문서, 웹사이트, 긴 텍스트 등 무엇이든 완벽하게 요약하는 기능',
    icon: <FileText className="w-8 h-8" />,
    iconBg: 'bg-green-500',
    category: 'writing',
    favorite: false
  },
  {
    id: 2,
    title: '이메일보조',
    description: '상황과 목적에 맞는 전문적이고 정중한 이메일을 작성하는 기능',
    icon: <MessageSquare className="w-8 h-8" />,
    iconBg: 'bg-blue-500',
    category: 'writing',
    favorite: false
  },
  {
    id: 3,
    title: '레포트작성',
    description: '과제, 레포트, 문서 등 긴 텍스트를 쉽게 완성하는 기능',
    icon: <FileText className="w-8 h-8" />,
    iconBg: 'bg-purple-500',
    category: 'writing',
    favorite: false
  },
  {
    id: 4,
    title: '블로그',
    description: '주제와 키워드에 맞는 SEO 최적화된 블로그 글을 작성하는 기능',
    icon: <Newspaper className="w-8 h-8" />,
    iconBg: 'bg-orange-500',
    category: 'writing',
    favorite: false
  },
  {
    id: 5,
    title: '자기소개서',
    description: '지원 직무와 경력에 맞는 매력적인 자기소개서를 작성하는 기능',
    icon: <Briefcase className="w-8 h-8" />,
    iconBg: 'bg-indigo-500',
    category: 'writing',
    favorite: false
  },

  // AI 컨텐츠 제작
  {
    id: 6,
    title: 'SNS 게시물',
    description: 'SNS 유형에 따라 자동으로 SNS 게시물을 완성하는 기능',
    icon: <MessageSquare className="w-8 h-8" />,
    iconBg: 'bg-purple-500',
    category: 'content',
    favorite: false
  },
  {
    id: 7,
    title: '강의 녹음 노트',
    description: '대화를 녹음하고 실시간 요약과 최종 요약을 작성하는 기능',
    icon: <FileVideo className="w-8 h-8" />,
    iconBg: 'bg-red-500',
    category: 'content',
    favorite: false
  },
  {
    id: 8,
    title: '면접 준비',
    description: '예상 면접 질문과 답변을 자동으로 완성하는 기능',
    icon: <Briefcase className="w-8 h-8" />,
    iconBg: 'bg-pink-500',
    category: 'content',
    favorite: false
  },

  // AI 발표자료
  {
    id: 9,
    title: 'PPT 초안',
    description: 'AI가 PPT의 목차와 초안을 자동으로 작성하는 기능',
    icon: <Presentation className="w-8 h-8" />,
    iconBg: 'bg-blue-500',
    category: 'presentation',
    favorite: false
  },
  {
    id: 10,
    title: '발표 대본',
    description: '발표 자료, 시간, 주제를 입력하면 대본을 완성하는 기능',
    icon: <FileVideo className="w-8 h-8" />,
    iconBg: 'bg-red-500',
    category: 'presentation',
    favorite: false
  },

  // AI 코딩
  {
    id: 11,
    title: '코드 생성',
    description: '요구사항을 입력하면 AI가 코드를 자동으로 생성하는 기능',
    icon: <Code className="w-8 h-8" />,
    iconBg: 'bg-green-500',
    category: 'coding',
    favorite: false
  },
  {
    id: 12,
    title: '코드 리뷰',
    description: '작성된 코드를 분석하고 개선점을 제안하는 기능',
    icon: <Code className="w-8 h-8" />,
    iconBg: 'bg-blue-500',
    category: 'coding',
    favorite: false
  },
];

export default function Productivity() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [tools, setTools] = useState(productivityTools);
  const router = useRouter();

  const filteredTools = selectedCategory 
    ? tools.filter(tool => tool.category === selectedCategory)
    : [];

  const toggleFavorite = (id: number) => {
    setTools(tools.map(tool => 
      tool.id === id ? { ...tool, favorite: !tool.favorite } : tool
    ));
  };

  const handleCategoryClick = (categoryId: string) => {
    setSelectedCategory(selectedCategory === categoryId ? null : categoryId);
  };

  const handleToolClick = (toolId: number) => {
    // AI 완벽요약 도구 클릭 시 해당 페이지로 이동
    if (toolId === 1) {
      router.push('/productivity/ai-summary');
    }
    // 레포트 작성 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 3) {
      router.push('/productivity/report-writer');
    }
    // 블로그 작성 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 4) {
      router.push('/productivity/blog-writer');
    }
    // SNS 게시물 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 6) {
      router.push('/productivity/sns-post');
    }
    // 코드 생성 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 11) {
      router.push('/productivity/code-generate');
    }
    // 코드 리뷰 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 12) {
      router.push('/productivity/code-review');
    }
    // 이메일 보조 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 2) {
      router.push('/productivity/email-assistant');
    }
    // PPT 초안 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 9) {
      router.push('/productivity/ppt-draft');
    }
    // 발표 대본 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 10) {
      router.push('/productivity/presentation-script');
    }
    // 강의 녹음 노트 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 7) {
      router.push('/productivity/lecture-notes');
    }
    // 면접 준비 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 8) {
      router.push('/productivity/interview-prep');
    }
    // 자기소개서 도구 클릭 시 해당 페이지로 이동
    else if (toolId === 5) {
      router.push('/productivity/cover-letter');
    }
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* 공통 사이드바 */}
          <Sidebar currentPath="/productivity" />
          
          {/* 메인 콘텐츠 */}
          <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">생산성 도구</h1>
                <p className="text-gray-600">AI를 활용한 다양한 생산성 도구들을 활용해보세요</p>
              </div>

              {/* 카테고리 선택 */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">카테고리</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryClick(category.id)}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 ${
                        selectedCategory === category.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`p-3 rounded-lg ${category.iconBg} text-white`}>
                          {category.icon}
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-900">{category.name}</h3>
                          <p className="text-sm text-gray-500">{category.description}</p>
                          <p className="text-xs text-gray-400 mt-1">{category.toolCount}개 도구</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 도구 목록 */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  {selectedCategory ? `${categories.find(c => c.id === selectedCategory)?.name} 도구` : '모든 도구'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(selectedCategory ? filteredTools : tools).map((tool) => (
                    <div
                      key={tool.id}
                      className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => handleToolClick(tool.id)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`p-3 rounded-lg ${tool.iconBg} text-white`}>
                          {tool.icon}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(tool.id);
                          }}
                          className="text-gray-400 hover:text-yellow-500 transition-colors"
                        >
                          <Star className={`w-5 h-5 ${tool.favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                        </button>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.title}</h3>
                      <p className="text-gray-600 text-sm">{tool.description}</p>
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