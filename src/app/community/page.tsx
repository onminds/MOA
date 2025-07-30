"use client";

import Header from '../components/Header';
import { useState } from 'react';
import { Pencil, MessageCircle, Heart, Search as SearchIcon, Flame, Users, Clock, Filter } from 'lucide-react';

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
const sortOptions = ['최신', '인기'];
const POSTS_PER_PAGE = 10;

export default function CommunityPage() {
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedSort, setSelectedSort] = useState('최신');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sideTab, setSideTab] = useState<'popular' | 'ranking' | 'comments'>('popular');

  // 필터링된 게시글
  const filteredPosts = dummyPosts.filter(
    (post) =>
      (selectedCategory === '전체' || post.category === selectedCategory) &&
      (search === '' || post.title.includes(search) || post.author.includes(search))
  );

  // 정렬된 게시글
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    switch (selectedSort) {
      case '최신':
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case '인기':
        return (b.likes + b.comments) - (a.likes + a.comments);
      default:
        return 0;
    }
  });

  // 페이지네이션
  const totalPages = Math.ceil(sortedPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = sortedPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

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

  const handleSortChange = (sort: string) => {
    setSelectedSort(sort);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  // 최근 24시간 내 게시글 필터링
  const getRecentPosts = () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return dummyPosts.filter(post => {
      const postDate = new Date(post.date);
      return postDate >= oneDayAgo;
    });
  };

  const recentPosts = getRecentPosts();

  // 인기 게시글 (좋아요 수 기준, 최근 24시간)
  const popularPosts = recentPosts
    .slice()
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 5);

  // 최다 조회 게시글 (조회수 기준 - 임시로 좋아요+댓글 수로 대체, 최근 24시간)
  const mostViewedPosts = recentPosts
    .slice()
    .sort((a, b) => (b.likes + b.comments * 2) - (a.likes + a.comments * 2))
    .slice(0, 5);

  // 최다 댓글 게시글 (댓글 수 기준, 최근 24시간)
  const mostCommentedPosts = recentPosts
    .slice()
    .sort((a, b) => b.comments - a.comments)
    .slice(0, 5);

  const activeUsers = [
    { name: 'user123', posts: 12 },
    { name: 'ai_fan', posts: 9 },
    { name: 'curious', posts: 7 },
    { name: 'foodie', posts: 6 },
    { name: 'skyblue', posts: 5 },
  ];

  // 상대적 시간 표시 함수
  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const postDate = new Date(dateString);
    const diffInMs = now.getTime() - postDate.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 3) {
      return '방금 전';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}분 전`;
    } else if (diffInHours < 24) {
      return `${diffInHours}시간 전`;
    } else {
      return postDate.toLocaleDateString('ko-KR');
    }
  };

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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* 상단 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">커뮤니티</h1>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors font-semibold">
              <Pencil className="w-5 h-5" />
              글쓰기
            </button>
          </div>

          <div className="flex gap-6">
            {/* 메인 콘텐츠 */}
            <div className="flex-1">
              {/* 카테고리 버튼들 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                <div className="flex gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => handleCategoryChange(cat)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        selectedCategory === cat 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 정렬 및 필터 옵션들 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* 정렬 버튼들 */}
                  <div className="flex gap-2">
                    {sortOptions.map((sort) => (
                      <button
                        key={sort}
                        onClick={() => handleSortChange(sort)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          selectedSort === sort 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                                                 {sort === '최신' && <Clock className="w-4 h-4" />}
                         {sort === '인기' && <Flame className="w-4 h-4" />}
                         {sort}
                      </button>
                    ))}
                  </div>

                  

                  {/* 검색창 */}
                  <div className="flex-1 max-w-xs">
                    <div className="relative">
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
                </div>
              </div>

              {/* 게시글 리스트 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {paginatedPosts.length === 0 ? (
                  <div className="text-gray-400 text-center py-12">게시글이 없습니다.</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {paginatedPosts.map(post => (
                      <div key={post.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 border">
                                {post.category}
                              </span>
                              <span className="text-xs text-gray-400">{getRelativeTime(post.date)}</span>
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-1 hover:text-blue-600 cursor-pointer transition-colors">
                              {post.title}
                            </h3>
                                                         <div className="flex items-center gap-4 text-sm text-gray-500">
                               <span>by {post.author}</span>
                               <div className="flex items-center gap-4">
                                 <div className="flex items-center gap-1">
                                   <Heart className="w-4 h-4" />
                                   <span>{post.likes}</span>
                                 </div>
                                 <div className="flex items-center gap-1">
                                   <MessageCircle className="w-4 h-4" />
                                   <span>{post.comments}</span>
                                 </div>
                               </div>
                             </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-6 gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
                    <button
                      key={num}
                      onClick={() => handlePageChange(num)}
                      className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                        page === num 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 오른쪽 사이드바 */}
            <div className="w-80 flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* 헤더 */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">실시간 Best</h2>
                    <p className="text-sm text-gray-500">최근 24시간 기준</p>
                  </div>
                </div>
                
                {/* 탭 버튼 */}
                <div className="flex border-b">
                  <button
                    className={`flex-1 py-3 text-center font-semibold transition-colors ${
                      sideTab === 'popular' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-blue-600 border border-blue-200 bg-white hover:bg-blue-50'
                    }`}
                    onClick={() => setSideTab('popular')}
                  >
                    인기 게시글
                  </button>
                  <button
                    className={`flex-1 py-3 text-center font-semibold transition-colors ${
                      sideTab === 'ranking' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-blue-600 border border-blue-200 bg-white hover:bg-blue-50'
                    }`}
                    onClick={() => setSideTab('ranking')}
                  >
                    최다 조회
                  </button>
                  <button
                    className={`flex-1 py-3 text-center font-semibold transition-colors ${
                      sideTab === 'comments' 
                        ? 'bg-blue-600 text-white' 
                        : 'text-blue-600 border border-blue-200 bg-white hover:bg-blue-50'
                    }`}
                    onClick={() => setSideTab('comments')}
                  >
                    최다 댓글
                  </button>
                </div>

                {/* 탭 내용 */}
                <div className="p-4">
                  {sideTab === 'popular' && (
                    <>
                      <h2 className="text-lg font-bold text-gray-900 mb-4">인기 게시글</h2>
                      <ul className="space-y-3">
                        {popularPosts.map((post, idx) => (
                          <li key={post.id} className="flex items-start gap-3">
                            <span className="text-gray-400 text-sm w-5 flex-shrink-0">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 text-sm truncate">{post.title}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {sideTab === 'ranking' && (
                    <>
                      <h2 className="text-lg font-bold text-gray-900 mb-4">최다 조회</h2>
                      <ul className="space-y-3">
                        {mostViewedPosts.map((post, idx) => (
                          <li key={post.id} className="flex items-start gap-3">
                            <span className="text-gray-400 text-sm w-5 flex-shrink-0">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 text-sm truncate">{post.title}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {sideTab === 'comments' && (
                    <>
                      <h2 className="text-lg font-bold text-gray-900 mb-4">최다 댓글</h2>
                      <ul className="space-y-3">
                        {mostCommentedPosts.map((post, idx) => (
                          <li key={post.id} className="flex items-start gap-3">
                            <span className="text-gray-400 text-sm w-5 flex-shrink-0">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-800 text-sm truncate">{post.title}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 