"use client";
import { useState } from "react";
import Header from '../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, LogIn,
  FileText, PenTool, Presentation, Code, Star, BookOpen, Briefcase, FileVideo, MessageSquare, Image, Video
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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
    // 다른 도구들도 필요에 따라 추가
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

        {/* 메인 콘텐츠 */}
        <div className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">생산성 도구</h1>
            
            {/* 카테고리 박스 그리드 */}
            {!selectedCategory && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className={`${category.iconBg} text-white p-3 rounded-lg`}>
                        {category.icon}
                      </div>
                      <div className="text-sm text-gray-500">
                        {category.toolCount}개 도구
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {category.name}
                    </h3>
                    
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {category.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 선택된 카테고리의 도구들 */}
            {selectedCategory && (
              <>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      ← 뒤로가기
                    </button>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {categories.find(cat => cat.id === selectedCategory)?.name}
                    </h2>
                  </div>
                </div>

                {/* 도구 카드 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredTools.map((tool) => (
                    <div
                      key={tool.id}
                      onClick={() => handleToolClick(tool.id)}
                      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={`${tool.iconBg} text-white p-3 rounded-lg`}>
                          {tool.icon}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(tool.id);
                          }}
                          className="text-gray-400 hover:text-yellow-500 transition-colors"
                        >
                          <Star className={`w-5 h-5 ${tool.favorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                        </button>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                        {tool.title}
                      </h3>
                      
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* 결과가 없을 때 */}
                {filteredTools.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-2">해당 카테고리의 도구가 없습니다</div>
                    <div className="text-gray-500 text-sm">다른 카테고리를 선택해보세요</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 