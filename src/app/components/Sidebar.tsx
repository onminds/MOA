"use client";
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, 
  Activity, Search, ChevronLeft, ChevronRight, User, LogOut, LogIn, Users
} from 'lucide-react';

interface SidebarProps {
  currentPath?: string;
}

export default function Sidebar({ currentPath = '/' }: SidebarProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const sideMenus = [
    { name: '홈', icon: <HomeIcon className="w-5 h-5" />, href: '/' },
    { name: '검색', icon: <Search className="w-5 h-5" />, href: '#' },
    { name: 'AI 목록', icon: <List className="w-5 h-5" />, href: '/ai-list' },
    { name: '순위', icon: <BarChart className="w-5 h-5" />, href: '#' },
    { name: '사용량 확인', icon: <Activity className="w-5 h-5" />, href: '/usage' },
    { name: '광고', icon: <Megaphone className="w-5 h-5" />, href: '#' },
    { name: 'AI 뉴스', icon: <Newspaper className="w-5 h-5" />, href: '#' },
    { name: '문의하기', icon: <MessageCircle className="w-5 h-5" />, href: '#' },
    { name: '설정', icon: <Settings className="w-5 h-5" />, href: '/settings' },
    { name: '커뮤니티', icon: <Users className="w-5 h-5" />, href: '/community' },
  ];

  const handleMenuClick = (href: string) => {
    if (href === '#') {
      // 아직 구현되지 않은 기능
      alert('곧 구현될 기능입니다.');
      return;
    }
    router.push(href);
  };

  return (
    <aside className={`bg-gray-50 min-h-screen flex flex-col transition-all duration-300 ease-in-out relative ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* 사이드바 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 min-h-[60px]">
        <div className={`transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
          <h2 className="text-lg font-semibold text-gray-800 whitespace-nowrap">MOA</h2>
        </div>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 p-4 space-y-2">
        {sideMenus.map((menu) => (
          <button
            key={menu.name}
            onClick={() => handleMenuClick(menu.href)}
            className={`w-full flex items-center px-3 py-3 rounded-lg text-gray-800 hover:bg-gray-200 transition-colors font-medium group ${
              currentPath === menu.href ? 'bg-gray-200 text-gray-900' : ''
            }`}
            title={isCollapsed ? menu.name : undefined}
          >
            <div className="flex-shrink-0">
              {menu.icon}
            </div>
            <div className={`transition-all duration-300 ml-3 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
              <span className="whitespace-nowrap">{menu.name}</span>
            </div>
            {/* 툴팁 (접힌 상태에서만) */}
            {isCollapsed && (
              <div className="absolute left-16 bg-gray-800 text-white text-sm px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {menu.name}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* 사용자 정보 및 로그인/로그아웃 */}
      <div className="p-4 border-t border-gray-200">
        {status === 'loading' ? (
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
          </div>
        ) : session ? (
          <div className="space-y-3">
            <div className={`transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
              <div className="text-center">
                <div className="text-sm text-gray-600 mb-1">안녕하세요!</div>
                <div className="text-sm font-semibold text-gray-800 truncate">
                  {session.user?.name || session.user?.email}
                </div>
              </div>
            </div>
            <button 
              onClick={() => signOut()}
              className="w-full flex items-center justify-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              title={isCollapsed ? "로그아웃" : undefined}
            >
              <LogOut className="w-4 h-4" />
              <div className={`transition-all duration-300 ml-2 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                <span className="whitespace-nowrap">로그아웃</span>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={`transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
              <div className="text-center">
                <div className="text-sm text-gray-600">로그인이 필요합니다</div>
              </div>
            </div>
            <button 
              onClick={() => router.push('/auth/signin')}
              className="w-full flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              title={isCollapsed ? "로그인" : undefined}
            >
              <LogIn className="w-4 h-4" />
              <div className={`transition-all duration-300 ml-2 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                <span className="whitespace-nowrap">로그인</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 접기/펼치기 버튼 (사이드바 중앙) */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-4 top-1/2 transform -translate-y-1/2 bg-white border border-gray-200 rounded-full p-2.5 shadow-lg hover:bg-gray-50 transition-colors z-10"
        title={isCollapsed ? "사이드바 펼치기" : "사이드바 접기"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        )}
      </button>
    </aside>
  );
} 