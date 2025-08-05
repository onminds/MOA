"use client";

import Header from '../components/Header';
<<<<<<< HEAD
import { useState, useEffect, useRef } from 'react';
import { Pencil, MessageCircle, Heart, Search as SearchIcon, Flame, Users, Clock, Filter } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Post {
  id: number;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
  comment_count: number;
  like_count: number;
  category_name: string;
  author_id: number;
}

const categories = [
  { id: 1, name: '공지' },
  { id: 2, name: 'Q&A' },
  { id: 3, name: '자유' }
];
const sortOptions = ['최신', '인기'];
const POSTS_PER_PAGE = 10;

// Toast 컴포넌트
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
      {message}
      <button onClick={onClose} className="ml-2 font-bold">×</button>
    </div>
  );
}

export default function CommunityPage() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedSort, setSelectedSort] = useState('최신');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sideTab, setSideTab] = useState<'popular' | 'ranking' | 'comments'>('popular');
  
  // 게시글 작성 관련 상태
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeCategory, setWriteCategory] = useState(categories[0].name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // 게시글 데이터 가져오기
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch('/api/community/posts');
        if (response.ok) {
          const data = await response.json();
          setPosts(data.posts);
        }
      } catch (error) {
        console.error('게시글 조회 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  // 필터링된 게시글
  const filteredPosts = posts.filter(
    (post) =>
      (selectedCategory === '전체' || post.category_name === selectedCategory) &&
      (search === '' || post.title.includes(search) || post.author_name.includes(search))
  );

  // 정렬된 게시글
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    switch (selectedSort) {
      case '최신':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case '인기':
        return (b.like_count + b.comment_count) - (a.like_count + a.comment_count);
      default:
        return 0;
    }
  });

  // 페이지네이션
  const totalPages = Math.ceil(sortedPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = sortedPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
=======
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
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

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
<<<<<<< HEAD

  const handleSortChange = (sort: string) => {
    setSelectedSort(sort);
    setPage(1);
  };

=======
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

<<<<<<< HEAD
  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!showWriteForm) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowWriteForm(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showWriteForm]);

  // 글쓰기 폼 제출
  const handleWriteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const selectedCategory = categories.find(cat => cat.name === writeCategory);
      const category_id = selectedCategory ? selectedCategory.id : null;
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: writeTitle,
          content: writeContent,
          category_id
        })
      });
      if (res.ok) {
        setShowWriteForm(false);
        setWriteTitle('');
        setWriteContent('');
        setWriteCategory(categories[0].name);
        // 새로고침
        const data = await fetch('/api/community/posts').then(r => r.json());
        setPosts(data.posts);
        setPage(1);
        setToast({ message: '게시글이 등록되었습니다!', type: 'success' });
      } else {
        setToast({ message: '게시글 등록 실패', type: 'error' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 최근 24시간 내 게시글 필터링
  const getRecentPosts = () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return posts.filter(post => {
      const postDate = new Date(post.created_at);
      return postDate >= oneDayAgo;
    });
  };

  const recentPosts = getRecentPosts();

  // 인기 게시글 (좋아요 수 기준, 최근 24시간)
  const popularPosts = recentPosts
    .slice()
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, 5);

  // 최다 조회 게시글 (조회수 기준 - 임시로 좋아요+댓글 수로 대체, 최근 24시간)
  const mostViewedPosts = recentPosts
    .slice()
    .sort((a, b) => (b.like_count + b.comment_count * 2) - (a.like_count + a.comment_count * 2))
    .slice(0, 5);

  // 최다 댓글 게시글 (댓글 수 기준, 최근 24시간)
  const mostCommentedPosts = recentPosts
    .slice()
    .sort((a, b) => b.comment_count - a.comment_count)
=======
  const popularPosts = dummyPosts
    .slice()
    .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
    .slice(0, 5);

  const activeUsers = [
    { name: 'user123', posts: 12 },
    { name: 'ai_fan', posts: 9 },
    { name: 'curious', posts: 7 },
    { name: 'foodie', posts: 6 },
    { name: 'skyblue', posts: 5 },
  ];

<<<<<<< HEAD
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

=======
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
  const recentComments = [
    { user: 'ai_fan', postTitle: '오늘의 잡담: AI가 바꿀 미래는?', content: '정말 기대돼요!', date: '2024-06-11' },
    { user: 'user123', postTitle: 'Q&A: AI 추천 좀 해주세요', content: 'GPT-4 추천합니다!', date: '2024-06-10' },
    { user: 'curious', postTitle: 'Q&A: GPT-4와 3.5 차이?', content: '답변 감사합니다!', date: '2024-06-09' },
    { user: 'foodie', postTitle: '자유: 오늘 점심 뭐 먹지?', content: '라면이 최고죠!', date: '2024-06-08' },
    { user: 'skyblue', postTitle: '자유: 오늘 날씨 너무 좋네요', content: '산책 가고 싶어요~', date: '2024-06-07' },
  ];

  return (
    <>
<<<<<<< HEAD
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* 상단 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">커뮤니티</h1>
          </div>

          <div className="flex gap-6">
            {/* 메인 콘텐츠 */}
            <div className="flex-1">
              {/* 카테고리 버튼들 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCategoryChange('전체')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      selectedCategory === '전체' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    전체
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.name)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        selectedCategory === cat.name 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 정렬 및 필터 옵션들 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                <div className="flex items-center justify-between gap-4">
                  {/* 왼쪽 영역: 정렬 버튼들 + 검색창 */}
                  <div className="flex items-center gap-4 flex-1">
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
                    <div className="max-w-xs">
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

                  {/* 오른쪽 영역: 글쓰기 버튼 */}
                  <div className="flex-shrink-0">
                    {session?.user?.id ? (
                      <button 
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors font-semibold"
                        onClick={() => setShowWriteForm(true)}
                      >
                        <Pencil className="w-5 h-5" />
                        글쓰기
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                        <Pencil className="w-5 h-5" />
                        <span className="text-sm">로그인이 필요합니다</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 게시글 작성 폼 */}
              {showWriteForm && session?.user?.id && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
                  onClick={e => {
                    if (e.target === e.currentTarget) setShowWriteForm(false);
                  }}
                >
                  <form
                    ref={formRef}
                    onSubmit={handleWriteSubmit}
                    className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg flex flex-col gap-5 border border-gray-100 animate-fade-in-up relative"
                    onClick={e => e.stopPropagation()}
                  >
                    <h2 className="text-2xl font-bold mb-2 text-gray-900">게시글 작성</h2>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-gray-800">카테고리</span>
                      <select
                        value={writeCategory}
                        onChange={e => setWriteCategory(e.target.value)}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:outline-none bg-gray-50 text-gray-900"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name} className="text-gray-900">{cat.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-gray-800">제목</span>
                      <input
                        type="text"
                        value={writeTitle}
                        onChange={e => setWriteTitle(e.target.value)}
                        className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:outline-none bg-gray-50 text-gray-900 placeholder-gray-500"
                        placeholder="제목을 입력하세요"
                        required
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-medium text-gray-800">내용</span>
                      <textarea
                        value={writeContent}
                        onChange={e => setWriteContent(e.target.value)}
                        className="border rounded-lg px-3 py-2 min-h-[120px] focus:ring-2 focus:ring-blue-400 focus:outline-none bg-gray-50 text-gray-900 placeholder-gray-500 resize-y"
                        placeholder="내용을 입력하세요"
                        required
                      />
                    </label>
                    <div className="flex gap-2 justify-end mt-2">
                      <button
                        type="button"
                        className="px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium shadow-sm border border-gray-400 transition-colors"
                        onClick={() => setShowWriteForm(false)}
                        disabled={isSubmitting}
                      >
                        취소
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-60"
                        disabled={isSubmitting || !writeTitle.trim() || !writeContent.trim()}
                      >
                        {isSubmitting && (
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                        )}
                        {isSubmitting ? '등록 중...' : '등록'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 게시글 리스트 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                  <div className="text-gray-400 text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    게시글을 불러오는 중...
                  </div>
                ) : paginatedPosts.length === 0 ? (
                  <div className="text-gray-400 text-center py-12">게시글이 없습니다.</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {paginatedPosts.map(post => (
                      <Link key={post.id} href={`/community/${post.id}`} className="block">
                        <div className="p-4 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 border">
                                  {post.category_name}
                                </span>
                                <span className="text-xs text-gray-400">{getRelativeTime(post.created_at)}</span>
                              </div>
                              <h3 className="font-semibold text-gray-900 mb-1 hover:text-blue-600 cursor-pointer transition-colors">
                                {post.title}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <span>by {post.author_name}</span>
                                <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1">
                                    <Heart className="w-4 h-4" />
                                    <span>{post.like_count}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <MessageCircle className="w-4 h-4" />
                                    <span>{post.comment_count}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
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
=======
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
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      </div>
    </>
  );
} 