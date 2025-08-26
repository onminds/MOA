"use client";

import Header from '../components/Header';
import { useState, useEffect, useRef } from 'react';
import { Pencil, MessageCircle, Heart, Search as SearchIcon, Flame, Users, Clock, Filter, HelpCircle, Eye } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

interface Post {
  id: number;
  title: string;
  content: string;
  author_name: string;
  created_at: string;
  updated_at?: string;
  comment_count: number;
  like_count: number;
  view_count: number;
  category_name: string;
  author_id: number;
  first_image_id?: number;
}

const categories = [
  { id: 1, name: '공지' },
  { id: 2, name: 'Q&A' },
  { id: 3, name: '자유' },
  { id: 4, name: '프롬프트 공유' },
  { id: 5, name: '정보' },
  { id: 6, name: '이미지' },
  { id: 7, name: '영상' }
];

const sortOptions = ['최신', '인기', '조회'];
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
  const [selectedSort, setSelectedSort] = useState('최신'); // 'latest'에서 '최신'으로 변경
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalPosts: 0,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [sideTab, setSideTab] = useState<'popular' | 'ranking' | 'comments'>('popular');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // 실시간 Best 상태 추가
  const [bestPosts, setBestPosts] = useState({
    popular: [] as Post[],
    views: [] as Post[],
    comments: [] as Post[]
  });
  const [bestLoading, setBestLoading] = useState(true);

  // 모달용 상태 추가
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeContent, setWriteContent] = useState('');
  const [writeCategory, setWriteCategory] = useState('Q&A');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuestionModal, setIsQuestionModal] = useState(false);

  // 실시간 Best 데이터 가져오기
  useEffect(() => {
    const fetchBestPosts = async () => {
      try {
        setBestLoading(true);
        
        // 인기, 조회수, 댓글 순으로 각각 가져오기
        const [popularRes, viewsRes, commentsRes] = await Promise.all([
          fetch('/api/community/posts/best?type=popular&limit=5'),
          fetch('/api/community/posts/best?type=views&limit=5'),
          fetch('/api/community/posts/best?type=comments&limit=5')
        ]);
        
        const popularData = popularRes.ok ? await popularRes.json() : { posts: [] };
        const viewsData = viewsRes.ok ? await viewsRes.json() : { posts: [] };
        const commentsData = commentsRes.ok ? await commentsRes.json() : { posts: [] };
        
        setBestPosts({
          popular: popularData.posts || [],
          views: viewsData.posts || [],
          comments: commentsData.posts || []
        });
      } catch (error) {
        console.error('실시간 Best 조회 오류:', error);
      } finally {
        setBestLoading(false);
      }
    };

    fetchBestPosts();
  }, []);

  // 게시글 데이터 가져오기 (서버 사이드 페이지네이션)
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        
        // 정렬 파라미터 매핑
        const getSortParam = (sort: string) => {
          switch (sort) {
            case '최신': return 'latest';
            case '인기': return 'popular';
            case '조회': return 'views';
            default: return 'latest';
          }
        };
        
        // URL 파라미터 구성
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '10',
          sort: getSortParam(selectedSort)
        });
        
        if (selectedCategory !== '전체') {
          params.append('category', selectedCategory);
        }
        
        if (search.trim()) {
          params.append('search', search.trim());
        }
        
        const response = await fetch(`/api/community/posts?${params}`);
        if (response.ok) {
          const data = await response.json();
          setPosts(data.posts || []);
          setPagination(data.pagination || {
            currentPage: 1,
            totalPages: 1,
            totalPosts: 0,
            hasNextPage: false,
            hasPrevPage: false
          });
        }
      } catch (error) {
        console.error('게시글 조회 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [page, selectedCategory, selectedSort, search]);

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

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!showWriteForm) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowWriteForm(false);
        setIsQuestionModal(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showWriteForm]);

  // 글쓰기 폼 제출 (모달용)
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
        setWriteCategory('Q&A');
        const data = await fetch('/api/community/posts').then(r => r.json());
        setPosts(data.posts || []);
        setPage(1);
        setToast({ message: '게시글이 등록되었습니다!', type: 'success' });
      } else {
        setToast({ message: '게시글 등록 실패', type: 'error' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 실시간 Best 데이터 (API에서 가져온 데이터 사용)

  const activeUsers = [
    { name: 'user123', posts: 12 },
    { name: 'ai_fan', posts: 9 },
    { name: 'curious', posts: 7 },
    { name: 'foodie', posts: 6 },
    { name: 'skyblue', posts: 5 },
  ];

  // 실제 시간 표시 함수 (서버 시간을 한국 시간으로 변환)
  const getDateTime = (dateString: string) => {
    const postDate = new Date(dateString);
    
    // 서버 시간을 한국 시간으로 변환 (9시간 차이 보정 - 빼기)
    const koreanTime = new Date(postDate.getTime() - (9 * 60 * 60 * 1000));
    
    return koreanTime.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Seoul'
    });
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* 상단 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">커뮤니티</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 메인 콘텐츠 */}
            <div className="md:col-span-2">
              {/* 카테고리 버튼들 */}
              <div className="flex gap-2 mb-4">
                <button
                    onClick={() => handleCategoryChange('전체')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                      selectedCategory === '전체' 
                        ? 'bg-black text-white shadow' 
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                  전체
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.name)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                        selectedCategory === cat.name 
                          ? 'bg-black text-white shadow' 
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* 정렬, 필터, 글쓰기 바 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 flex items-center justify-between gap-4">
                  {/* 왼쪽 영역: 정렬 버튼들 + 검색창 */}
                  <div className="flex items-center gap-4 flex-1">
                    {/* 정렬 버튼들 */}
                    <div className="flex items-center gap-2 border-r pr-4">
                      {sortOptions.map((sort) => (
                        <button
                          key={sort}
                          onClick={() => handleSortChange(sort)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                            selectedSort === sort 
                              ? 'bg-black text-white shadow-md' 
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                          }`}
                        >
                          {sort === '최신' && <Clock className="w-4 h-4" />}
                          {sort === '인기' && <Flame className="w-4 h-4" />}
                          {sort === '조회' && <Eye className="w-4 h-4" />}
                          {sort}
                        </button>
                      ))}
                    </div>

                    {/* 검색창 */}
                    <div className="relative flex-1 max-w-sm">
                      <input
                        type="text"
                        value={search}
                        onChange={handleSearchChange}
                        placeholder="게시글 검색..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg border-transparent focus:ring-2 focus:ring-gray-300 focus:outline-none text-gray-900 bg-transparent"
                      />
                      <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                  </div>

                  {/* 오른쪽 영역: 글쓰기 버튼 */}
                  <div className="flex-shrink-0">
                    {session?.user?.id ? (
                      <Link
                        href="/community/write"
                        className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg shadow hover:bg-gray-800 transition-colors font-semibold"
                      >
                        <Pencil className="w-4 h-4" />
                        글쓰기
                      </Link>
                    ) : (
                       <Link
                        href="/auth/signin"
                        className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
                      >
                        <Pencil className="w-4 h-4" />
                        글쓰기
                      </Link>
                    )}
                  </div>
              </div>

              {/* 게시글 리스트 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                {loading ? (
                  <div className="text-gray-500 text-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                    게시글을 불러오는 중...
                  </div>
                ) : posts.length === 0 ? (
                  <div className="text-gray-500 text-center p-12">게시글이 없습니다.</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {posts.map(post => (
                      <Link key={post.id} href={`/community/${post.id}`} className="block p-5 hover:bg-gray-50 transition-colors">
                        <div className="flex gap-4">
                          {/* 게시글 정보 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {post.category_name}
                              </span>
                              <span className="text-xs text-gray-400">{getDateTime(post.created_at)}</span>
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 mb-2.5 break-all">
                              {post.title}
                            </h3>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">by {post.author_name}</span>
                            </div>
                          </div>
                          
                          {/* 이미지 미리보기와 통계 */}
                          <div className="flex flex-col items-end gap-2">
                            {post.first_image_id ? (
                              <div className="flex-shrink-0">
                                <div className="w-24 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                  <img
                                    src={`/api/community/posts/images/${post.first_image_id}`}
                                    alt="게시글 이미지"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      // 이미지 로드 실패 시 기본 아이콘 표시
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                  <div className="hidden w-full h-full flex items-center justify-center bg-gray-100">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // 이미지가 없을 때 빈 공간을 만들어 높이 통일
                              <div className="w-24 h-16"></div>
                            )}
                            
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Heart className="w-4 h-4" />
                                <span>{post.like_count}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageCircle className="w-4 h-4" />
                                <span>{post.comment_count}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                <span>{post.view_count}</span>
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
              {pagination.totalPages > 1 && (
                <div className="flex justify-center mt-6 gap-2">
                  {/* 이전 페이지 */}
                  {pagination.hasPrevPage && (
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      className="px-3 py-2 rounded-lg border font-medium bg-white text-gray-700 border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      이전
                    </button>
                  )}
                  
                  {/* 페이지 번호들 */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 rounded-lg border font-medium transition-colors ${
                          pageNum === page
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  {/* 다음 페이지 */}
                  {pagination.hasNextPage && (
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      className="px-3 py-2 rounded-lg border font-medium bg-white text-gray-700 border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      다음
                    </button>
                  )}
                </div>
              )}
              
              {/* 게시글 수 표시 */}
              <div className="text-center text-sm text-gray-500 mt-4">
                총 {pagination.totalPosts}개의 게시글
              </div>
            </div>

            {/* 오른쪽 사이드바 */}
            <div className="w-full space-y-6">
              {/* 실시간 Best */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">실시간 Best</h2>
                  <p className="text-sm text-gray-500">최근 24시간</p>
                </div>
                
                <div className="p-3">
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                        className={`flex-1 py-1.5 text-center text-sm font-semibold transition-all duration-200 rounded-md ${
                          sideTab === 'popular' 
                            ? 'bg-white text-black shadow-sm' 
                            : 'bg-transparent text-gray-600'
                        }`}
                      onClick={() => setSideTab('popular')}
                    >
                      인기
                    </button>
                    <button
                        className={`flex-1 py-1.5 text-center text-sm font-semibold transition-all duration-200 rounded-md ${
                          sideTab === 'ranking' 
                            ? 'bg-white text-black shadow-sm' 
                            : 'bg-transparent text-gray-600'
                        }`}
                      onClick={() => setSideTab('ranking')}
                    >
                      조회 순
                    </button>
                    <button
                        className={`flex-1 py-1.5 text-center text-sm font-semibold transition-all duration-200 rounded-md ${
                          sideTab === 'comments' 
                            ? 'bg-white text-black shadow-sm' 
                            : 'bg-transparent text-gray-600'
                        }`}
                      onClick={() => setSideTab('comments')}
                    >
                      댓글 순
                    </button>
                  </div>
                </div>

                {/* 탭 내용 */}
                <div className="p-4 pt-0">
                  {bestLoading ? (
                    <div className="text-sm text-gray-400 text-center py-2">
                      실시간 Best를 불러오는 중...
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {
                        (sideTab === 'popular' ? bestPosts.popular : sideTab === 'ranking' ? bestPosts.views : bestPosts.comments)
                        .map((post, idx) => (
                          <li key={post.id} className="flex items-center gap-3 text-sm">
                            <span className="font-bold text-gray-700 w-5 flex-shrink-0">{idx + 1}.</span>
                            <span className="font-medium text-gray-700 truncate flex-1 min-w-0 hover:underline">
                              <Link href={`/community/${post.id}`}>{post.title}</Link>
                            </span>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {sideTab === 'popular' && `♥${post.like_count}`}
                              {sideTab === 'ranking' && `👁${post.view_count}`}
                              {sideTab === 'comments' && `💬${post.comment_count}`}
                            </span>
                          </li>
                        ))
                      }
                      {(sideTab === 'popular' ? bestPosts.popular : sideTab === 'ranking' ? bestPosts.views : bestPosts.comments).length === 0 && (
                        <li className="text-sm text-gray-400 text-center py-2">
                          최근 24시간 내 {sideTab === 'popular' ? '인기' : sideTab === 'ranking' ? '조회' : '댓글'} 글이 없습니다.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>

              {/* 오늘의 질문 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h2 className="text-lg font-bold text-gray-900 mb-2">오늘의 질문</h2>
                <p className="text-sm text-gray-500 mb-4">
                  초보자도 환영! 간단한 질문이라도 괜찮아요.
                </p>
                <button 
                  className="w-full bg-black text-white py-2.5 px-4 rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                  onClick={() => {
                    setShowWriteForm(true);
                  }}
                >
                 <HelpCircle className="w-5 h-5" />
                 질문하러 가기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 글쓰기 모달 */}
      {showWriteForm && session?.user?.id && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={e => {
            if (e.target === e.currentTarget) {
              setShowWriteForm(false);
            }
          }}
        >
          <form
            ref={formRef}
            onSubmit={handleWriteSubmit}
            className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg flex flex-col gap-5 border border-gray-100 animate-fade-in-up relative"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-2 text-gray-900">질문 작성</h2>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-gray-800">카테고리</span>
                <input
                  type="text"
                  value="Q&A"
                  readOnly
                  className="border rounded-lg px-3 py-2 bg-gray-200 text-gray-700 cursor-not-allowed"
                />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-gray-800">제목</span>
              <input
                type="text"
                value={writeTitle}
                onChange={e => setWriteTitle(e.target.value)}
                className="border rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-400 focus:outline-none bg-gray-50 text-gray-900 placeholder-gray-500"
                placeholder="질문을 입력하세요"
                required
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-gray-800">내용</span>
              <textarea
                value={writeContent}
                onChange={e => setWriteContent(e.target.value)}
                className="border rounded-lg px-3 py-2 min-h-[120px] focus:ring-2 focus:ring-gray-400 focus:outline-none bg-gray-50 text-gray-900 placeholder-gray-500 resize-y"
                placeholder="궁금한 점을 자세하게 적어주세요."
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
                className="px-5 py-2 rounded-lg bg-black text-white font-semibold shadow-md hover:bg-gray-800 active:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-60"
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
    </>
  );
} 