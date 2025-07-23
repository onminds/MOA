"use client";

import Header from '../components/Header';
import { useState } from 'react';
import { Pencil, MessageCircle, Heart, Search as SearchIcon } from 'lucide-react';

const dummyPosts = [
  { id: 1, title: 'MOA 커뮤니티에 오신 것을 환영합니다!', author: '관리자', date: '2024-06-01', comments: 3, likes: 12, category: '공지' },
  { id: 2, title: '자유롭게 질문하고 답변해보세요', author: 'user123', date: '2024-06-02', comments: 5, likes: 8, category: 'Q&A' },
  { id: 3, title: '오늘의 잡담: AI가 바꿀 미래는?', author: 'ai_fan', date: '2024-06-03', comments: 2, likes: 5, category: '자유' },
  { id: 4, title: '공지: 커뮤니티 이용 규칙 안내', author: '관리자', date: '2024-06-04', comments: 0, likes: 2, category: '공지' },
  { id: 5, title: 'Q&A: AI 추천 좀 해주세요', author: 'ai_lover', date: '2024-06-05', comments: 4, likes: 7, category: 'Q&A' },
  { id: 6, title: '자유: 오늘 점심 뭐 먹지?', author: 'foodie', date: '2024-06-06', comments: 1, likes: 1, category: '자유' },
  { id: 7, title: '공지: 서버 점검 안내', author: '관리자', date: '2024-06-07', comments: 0, likes: 0, category: '공지' },
  { id: 8, title: 'Q&A: GPT-4와 3.5 차이?', author: 'curious', date: '2024-06-08', comments: 2, likes: 3, category: 'Q&A' },
  { id: 9, title: '자유: 오늘 날씨 너무 좋네요', author: 'skyblue', date: '2024-06-09', comments: 0, likes: 2, category: '자유' },
  { id: 10, title: '공지: 신규 기능 안내', author: '관리자', date: '2024-06-10', comments: 1, likes: 4, category: '공지' },
];

const categories = ['전체', '공지', 'Q&A', '자유'];
const POSTS_PER_PAGE = 5;

export default function CommunityPage() {
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sideTab, setSideTab] = useState<'popular' | 'ranking' | 'comments'>('popular');

  // 필터링된 게시글
  const filteredPosts = dummyPosts.filter(
    (post) =>
      (selectedCategory === '전체' || post.category === selectedCategory) &&
      (search === '' || post.title.includes(search) || post.author.includes(search))
  );

  // 페이지네이션
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = filteredPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  // 페이지 변경 시 스크롤 상단 이동
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 카테고리/검색 변경 시 1페이지로 이동
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const popularPosts = dummyPosts
    .slice()
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
    .slice(0, 5);

  const activeUsers = [
    { name: 'user123', posts: 12 },
    { name: 'ai_fan', posts: 9 },
    { name: 'curious', posts: 7 },
    { name: 'foodie', posts: 6 },
    { name: 'skyblue', posts: 5 },
  ];

  const recentComments = [
    { user: 'ai_fan', postTitle: '오늘의 잡담: AI가 바꿀 미래는?', content: '정말 기대돼요!', date: '2024-06-11' },
    { user: 'user123', postTitle: 'Q&A: AI 추천 좀 해주세요', content: 'GPT-4 추천합니다!', date: '2024-06-10' },
    { user: 'curious', postTitle: 'Q&A: GPT-4와 3.5 차이?', content: '답변 감사합니다!', date: '2024-06-09' },
    { user: 'foodie', postTitle: '자유: 오늘 점심 뭐 먹지?', content: '라면이 최고죠!', date: '2024-06-08' },
    { user: 'skyblue', postTitle: '자유: 오늘 날씨 너무 좋네요', content: '산책 가고 싶어요~', date: '2024-06-07' },
  ];

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 flex w-full">
        {/* 왼쪽 카테고리 네비게이션 */}
        <nav className="hidden md:flex flex-col gap-2 sticky top-24 h-fit w-45 pl-8 pt-12 flex-shrink-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`w-full text-left px-4 py-2 rounded-lg font-medium border transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50'}`}
            >
              {cat}
            </button>
          ))}
        </nav>
        {/* 메인 콘텐츠 */}
        <main className="flex-1 max-w-3xl p-8 ml-50 mr-auto">
          {/* 상단: 타이틀, 글쓰기 버튼 */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">커뮤니티</h1>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors font-semibold">
              <Pencil className="w-5 h-5" /> 글쓰기
            </button>
          </div>
          {/* 검색창 */}
          <div className="mb-6 flex items-center gap-2">
            <div className="relative w-full max-w-xs">
              <input
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder="게시글 검색..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-200 focus:outline-none text-gray-900 bg-white"
              />
              <SearchIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>
          </div>
          {/* 게시글 리스트 */}
          <div className="space-y-4">
            {paginatedPosts.length === 0 ? (
              <div className="text-gray-400 text-center py-12">게시글이 없습니다.</div>
            ) : (
              paginatedPosts.map(post => (
                <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{post.category}</span>
                      <span className="text-xs text-gray-400">{post.date}</span>
                    </div>
                    <div className="font-semibold text-lg text-gray-900 mb-1">{post.title}</div>
                    <div className="text-sm text-gray-500">by {post.author}</div>
                  </div>
                  <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <div className="flex items-center gap-1 text-gray-500">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-sm">{post.comments}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-500">
                      <Heart className="w-4 h-4" />
                      <span className="text-sm">{post.likes}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-10 gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  onClick={() => handlePageChange(num)}
                  className={`px-4 py-2 rounded-lg border font-medium transition-colors ${page === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50'}`}
                >
                  {num}
                </button>
              ))}
            </div>
          )}
        </main>
        {/* 오른쪽 사이드 위젯 (탭 패널) */}
        <aside className="hidden md:flex flex-col w-72 pr-8 pt-30 flex-shrink-0 mt-10">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-0 overflow-hidden">
            {/* 탭 버튼 */}
            <div className="flex border-b">
              <button
                className={`flex-1 py-3 text-center font-semibold transition-colors ${sideTab === 'popular' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setSideTab('popular')}
              >
                인기 게시글
              </button>
              <button
                className={`flex-1 py-3 text-center font-semibold transition-colors ${sideTab === 'ranking' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setSideTab('ranking')}
              >
                활동 랭킹
              </button>
              <button
                className={`flex-1 py-3 text-center font-semibold transition-colors ${sideTab === 'comments' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                onClick={() => setSideTab('comments')}
              >
                최근 댓글
              </button>
            </div>
            {/* 탭 내용 */}
            <div className="p-6">
              {sideTab === 'popular' && (
                <>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">인기 게시글</h2>
                  <ul className="space-y-2">
                    {popularPosts.map((post, idx) => (
                      <li key={post.id} className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm w-5">{idx + 1}.</span>
                        <span className="truncate font-medium text-gray-800 text-sm">{post.title}</span>
                        <span className="ml-auto text-xs text-gray-500">♥ {post.likes} · 💬 {post.comments}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {sideTab === 'ranking' && (
                <>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">활동 랭킹</h2>
                  <ul className="space-y-2">
                    {activeUsers.map((user, idx) => (
                      <li key={user.name} className="flex items-center gap-2">
                        <span className="text-gray-400 text-sm w-5">{idx + 1}.</span>
                        <span className="font-medium text-gray-800 text-sm">{user.name}</span>
                        <span className="ml-auto text-xs text-gray-500">{user.posts}회</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {sideTab === 'comments' && (
                <>
                  <h2 className="text-lg font-bold text-gray-900 mb-4">최근 댓글</h2>
                  <ul className="space-y-2">
                    {recentComments.map((comment, idx) => (
                      <li key={idx} className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-800">{comment.user}</span>
                          <span className="text-gray-400">|</span>
                          <span className="truncate text-gray-600">{comment.postTitle}</span>
                          <span className="ml-auto text-xs text-gray-400">{comment.date}</span>
                        </div>
                        <div className="text-gray-500 text-xs ml-2 mt-0.5">{comment.content}</div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
} 