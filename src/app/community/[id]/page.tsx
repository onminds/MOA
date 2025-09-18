"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Header from "../../components/Header";
import { Heart, MessageCircle, Eye, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import ReportModal from "@/components/ReportModal";

// 완전한 커뮤니티 페이지 컴포넌트 (작은 버전)
function RelatedPostsList({ currentPostId, category }: { currentPostId: number; category: string }) {
  const [posts, setPosts] = useState<Array<{
    id: number;
    title: string;
    author: string;
    created_at: string;
    like_count: number;
    comment_count: number;
    view_count: number;
    category: string;
    image_count?: number; // 이미지 개수 필드 추가
    first_image_id?: number; // 첫 번째 이미지 ID 추가
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedSort, setSelectedSort] = useState('최신');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalPosts, setTotalPosts] = useState(0); // 총 게시글 수 상태

  const POSTS_PER_PAGE = 10;

  // 정렬 옵션
  const sortOptions = ['최신', '인기', '조회'];

  // 카테고리 옵션 - 실제 커뮤니티 카테고리와 동일하게 설정
  const categoryOptions = ['전체', '공지', 'Q&A', '자유', '프롬프트 공유', '정보', '이미지', '영상'];

  // 정렬 매핑
  const getSortParam = (sort: string) => {
    switch (sort) {
      case '최신': return 'latest';
      case '인기': return 'popular';
      case '조회': return 'views';
      default: return 'latest';
    }
  };

  // 게시글 로드
  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const categoryParam = selectedCategory === '전체' ? '' : selectedCategory;
        const sortParam = getSortParam(selectedSort);
        const offset = (currentPage - 1) * POSTS_PER_PAGE;
        
        const url = `/api/community/posts?page=${currentPage}&limit=${POSTS_PER_PAGE}&category=${categoryParam}&sort=${sortParam}&search=${searchQuery}&offset=${offset}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.posts) {
          const mappedPosts = data.posts.map((post: any) => ({
            id: post.id,
            title: post.title,
            author: post.author_name,
            created_at: post.created_at,
            like_count: post.like_count || 0,
            comment_count: post.comment_count || 0,
            view_count: post.view_count || 0,
            category: post.category_name,
            image_count: post.image_count || 0, // 이미지 개수 매핑
            first_image_id: post.first_image_id // 첫 번째 이미지 ID 매핑
          }));
          setPosts(mappedPosts);
          
          // API 응답에서 total 값을 안전하게 추출
          let total = 0;
          if (data.pagination && data.pagination.totalPosts) {
            total = data.pagination.totalPosts;
          } else if (data.total) {
            total = parseInt(data.total) || 0;
          } else {
            total = data.posts.length;
          }
          
          // totalPages 계산 및 NaN 방지
          const calculatedTotalPages = total > 0 ? Math.ceil(total / POSTS_PER_PAGE) : 1;
          setTotalPages(calculatedTotalPages);
          
          // 실제 총 게시글 수를 별도로 저장
          setTotalPosts(total);
          
          // 특정 카테고리에 게시글이 없고, 전체가 아닌 카테고리를 선택한 경우
          if (total === 0 && selectedCategory !== '전체' && data.posts.length === 0) {
            // 해당 카테고리에 게시글이 없음을 알리는 메시지 표시
            console.log(`${selectedCategory} 카테고리에 게시글이 없습니다.`);
          }
        }
      } catch (error) {
        console.error('게시글 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [currentPage, selectedCategory, selectedSort, searchQuery, currentPostId]);

  // 검색 처리
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    // 특정 카테고리를 선택했는데 게시글이 없는 경우
    if (selectedCategory !== '전체') {
      return (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <p className="mb-3">{selectedCategory} 카테고리에 게시글이 없습니다</p>
          <button
            onClick={() => {
              setSelectedCategory('전체');
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            전체 카테고리로 보기
          </button>
        </div>
      );
    }
    
    // 전체 카테고리에서도 게시글이 없는 경우
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
        <p>검색 결과가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 검색 및 필터 영역 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {/* 검색바 */}
        <form onSubmit={handleSearch} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="게시글 검색..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              검색
            </button>
          </div>
        </form>

        {/* 카테고리 및 정렬 필터 */}
        <div className="flex flex-wrap gap-3">
          {/* 카테고리 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">카테고리:</span>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* 정렬 선택 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">정렬:</span>
            <div className="flex gap-1">
              {sortOptions.map((sort) => (
                <button
                  key={sort}
                  onClick={() => {
                    setSelectedSort(sort);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedSort === sort
                      ? 'bg-black text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {sort}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 게시글 목록 */}
      <div className="space-y-2">
        {posts.map((post) => {
          const isCurrentPost = post.id === currentPostId;
          
          return (
            <div
              key={post.id}
              className={`block p-3 rounded-lg border transition-all duration-200 ${
                isCurrentPost
                  ? 'border-blue-300 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm hover:bg-gray-50'
              }`}
            >
              {isCurrentPost ? (
                // 현재 게시글 표시 (클릭 불가)
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium">
                        현재
                      </span>
                      <h3 className="font-medium text-gray-900 text-sm leading-tight line-clamp-1">
                        {post.title}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                        {post.category}
                      </span>
                      <span>{post.author}</span>
                      <span>{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                      <span className="text-gray-400">•</span>
                      <div className="flex items-center gap-3 text-gray-400">
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          <span>{post.like_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          <span>{post.comment_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>{post.view_count}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 현재 게시글 이미지 미리보기 - 이미지가 있을 때만 표시 */}
                  {(post.image_count ?? 0) > 0 && post.first_image_id && (
                    <div className="flex-shrink-0">
                      <img 
                        src={`/api/community/posts/images/${post.first_image_id}`}
                        alt="게시글 이미지"
                        className="w-16 h-16 object-cover rounded-lg border-2 border-blue-200"
                      />
                    </div>
                  )}
                  
                  <div className="text-blue-500 flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              ) : (
                // 다른 게시글 표시 (클릭 가능)
                <Link href={`/community/${post.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-sm leading-tight line-clamp-1 mb-1 hover:text-blue-600 transition-colors">
                        {post.title}
                      </h3>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {post.category}
                        </span>
                        <span>{post.author}</span>
                        <span>{new Date(post.created_at).toLocaleDateString('ko-KR')}</span>
                        <span className="text-gray-400">•</span>
                        <div className="flex items-center gap-3 text-gray-400">
                          <div className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            <span>{post.like_count}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            <span>{post.comment_count}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            <span>{post.view_count}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 다른 게시글 이미지 미리보기 - 이미지가 있을 때만 표시 */}
                    {(post.image_count ?? 0) > 0 && post.first_image_id && (
                      <div className="flex-shrink-0">
                        <img 
                          src={`/api/community/posts/images/${post.first_image_id}`}
                          alt="게시글 이미지"
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                    
                    <div className="text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </div>

                    {/* 페이지네이션 */}
        <div className="flex justify-center items-center gap-1 pt-4">
          {/* 이전 페이지 */}
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            이전
          </button>

          {/* 페이지 번호들 */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === pageNum
                    ? 'bg-black text-white shadow-md'
                    : 'border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          {/* 다음 페이지 */}
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            다음
          </button>
        </div>

               {/* 총 게시글 수 표시 - 정확한 수치 */}
        <div className="text-center pt-2 text-sm text-gray-500">
          총 {totalPosts > 0 ? totalPosts : posts.length}개의 게시글
        </div>
    </div>
  );
}

interface Post {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at?: string;
  author: string;
  category: string;
  like_count?: number;
  comment_count?: number;
  view_count?: number;
  image_count?: number;
  comments?: Comment[];
  images?: Array<{
    id: number;
    file_name: string;
    original_name: string;
    file_size: number;
    mime_type: string;
    width?: number;
    height?: number;
    created_at: string;
  }>;
  liked?: boolean;
  author_id?: number;
}

interface Comment {
  id: number;
  author: string;
  content: string;
  created_at: string;
  author_id?: number;
  parent_id?: number;
  parent_author?: string;
}

export default function CommunityPostDetail() {
  const params = useParams();
  const { data: session, status } = useSession();
  const isLoggedIn = !!session?.user?.id;
  const user_id = session?.user?.id;

  // 세션 상태 모니터링 및 강제 업데이트
  useEffect(() => {
    if (status === 'authenticated' && session) {
      // 소셜 로그인 사용자의 경우 세션 강제 업데이트
      const checkAndUpdateSession = async () => {
        try {
          const { getSession } = await import('next-auth/react');
          await getSession();
        } catch (error) {
          console.log('세션 업데이트 중 오류:', error);
        }
      };
      
      // 1초 후 세션 상태 확인 및 업데이트
      const timer = setTimeout(checkAndUpdateSession, 1000);
      return () => clearTimeout(timer);
    }
  }, [status, session]);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const router = useRouter();
  const [likeLoading, setLikeLoading] = useState(false);
  const [hasIncremented, setHasIncremented] = useState(false);
  const isAdmin = session?.user?.role === 'ADMIN';
  const requestRef = useRef(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  // 실제 시간 포맷팅 함수 (서버 시간을 한국 시간으로 변환)
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    
    // 디버깅용 로그
    console.log('시간 디버깅:', {
      원본시간: dateString,
      Date객체: date,
      UTC시간: date.toISOString(),
      현재시간: new Date().toISOString()
    });
    
    // 서버 시간을 한국 시간으로 변환 (9시간 차이 보정 - 빼기)
    const koreanTime = new Date(date.getTime() - (9 * 60 * 60 * 1000));
    
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
  
  // 세션 상태가 변경될 때마다 권한 정보 로깅 (디버깅용)
  useEffect(() => {
    if (session?.user) {
      console.log('세션 정보:', {
        id: session.user.id,
        idType: typeof session.user.id,
        email: session.user.email,
        role: session.user.role
      });
    }
  }, [session]);

  useEffect(() => {
    if (!params?.id) return;
    
    // useRef로 중복 요청 완전 방지
    if (requestRef.current) return;
    
    console.log('게시글 데이터 요청 시작:', { postId: params.id, user_id });
    
    // 즉시 ref 설정으로 중복 요청 방지
    requestRef.current = true;
    setHasIncremented(true);
    
    fetch(`/api/community/posts/${params.id}`)
      .then(res => {
        console.log('API 응답 상태:', res.status);
        if (!res.ok) {
          if (res.status === 404) {
            setPost(null);
            setLoading(false);
            return null;
          }
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data) {
          console.log('게시글 데이터:', {
            post: data,
            author_id: data?.author_id,
            author_idType: typeof data?.author_id,
            user_id: user_id,
            user_idType: typeof user_id,
            comparison: String(data?.author_id) === user_id,
            isLoggedIn: !!user_id,
            isAdmin: session?.user?.role === 'ADMIN'
          });
          setPost(data);
          setLiked(!!data.liked);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('게시글 데이터 요청 오류:', error);
        setPost(null);
        setLoading(false);
      });
  }, [params?.id, user_id, session?.user?.role]);

  const handleLike = async () => {
    if (!post || !isLoggedIn || likeLoading) return;
    setLikeLoading(true);
    try {
      if (!liked) {
        // 좋아요 추가
        const res = await fetch(`/api/community/posts/${post.id}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id })
        });
        const data = await res.json();
        const updated = await fetch(`/api/community/posts/${post.id}`).then(r => r.json());
        setPost(updated);
        setLiked(!!updated.liked);
      } else {
        // 좋아요 취소
        await fetch(`/api/community/posts/${post.id}/like`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id })
        });
        const updated = await fetch(`/api/community/posts/${post.id}`).then(r => r.json());
        setPost(updated);
        setLiked(!!updated.liked);
      }
    } finally {
      setLikeLoading(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim() || !post || !isLoggedIn) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, content: commentInput })
      });
      if (res.ok) {
        // 성공 시 게시글 데이터 새로고침 (상세 페이지에 머무름)
        const updated = await fetch(`/api/community/posts/${post.id}`).then(r => r.json());
        setPost(updated);
        setCommentInput("");
      }
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCommentDelete = async (commentId: number) => {
    if (!post || !isLoggedIn) return;
    await fetch(`/api/community/posts/${post.id}/comment/${commentId}/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id })
    });
    // 성공 시 게시글 데이터만 새로고침 (상세 페이지에 머무름)
    const updated = await fetch(`/api/community/posts/${post.id}`).then(r => r.json());
    setPost(updated);
  };

  const handleReplyClick = (commentId: number) => {
    if (!isLoggedIn) {
      alert('대댓글을 작성하려면 로그인하세요.');
      return;
    }
    setReplyingTo(commentId);
    setReplyInput("");
  };

  const handleReplySubmit = async (e: React.FormEvent, commentId: number) => {
    e.preventDefault();
    if (!replyInput.trim() || !post || !isLoggedIn) return;
    
    setReplySubmitting(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}/comment/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, content: replyInput })
      });
      if (res.ok) {
        // 성공 시 게시글 데이터 새로고침
        const updated = await fetch(`/api/community/posts/${post.id}`).then(r => r.json());
        setPost(updated);
        setReplyInput("");
        setReplyingTo(null);
      } else {
        const errorData = await res.json();
        alert(errorData.error || '대댓글 작성에 실패했습니다.');
      }
    } catch (error) {
      alert('서버 오류로 대댓글 작성에 실패했습니다.');
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setReplyInput("");
  };

  const handleDeletePost = async () => {
    if (!post || !isLoggedIn) return;
    if (!window.confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/community/posts/${post.id}/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        alert('게시글이 삭제되었습니다.');
        router.push('/community');
      } else {
        alert('게시글 삭제에 실패했습니다.');
      }
    } catch {
      alert('서버 오류로 삭제에 실패했습니다.');
    }
  };

  const handleEditPost = () => {
    // 수정 페이지로 이동
    router.push(`/community/edit/${params.id}`);
  };

  if (loading) return (
    <>
      <Header />
      <div className="w-full min-h-screen bg-gray-50">
        <div className="w-full max-w-7xl flex flex-col md:flex-row gap-8 px-2 md:px-8 py-8 mx-auto">
          <main className="flex-1 min-w-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin h-7 w-7 text-gray-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-gray-400 text-lg font-medium">로딩 중...</span>
            </div>
          </main>
        </div>
      </div>
    </>
  );
  if (!post) return (
    <>
      <Header />
      <div className="w-full min-h-screen bg-gray-50">
        <div className="w-full max-w-7xl flex flex-col md:flex-row gap-8 px-2 md:px-8 py-8 mx-auto">
          <main className="flex-1 min-w-0 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">게시글을 찾을 수 없습니다</h1>
              <p className="text-gray-600 mb-6">요청하신 게시글이 존재하지 않거나 삭제되었을 수 있습니다.</p>
              <Link 
                href="/community"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                커뮤니티로 돌아가기
              </Link>
            </div>
          </main>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Header />
      <div className="w-full min-h-screen bg-gray-50">
        <div className="w-full max-w-7xl flex flex-col md:flex-row gap-8 px-2 md:px-8 py-8 mx-auto">
          <main className="flex-1 min-w-0">
            {/* 커뮤니티로 돌아가기 버튼 */}
            <div className="mb-4">
              <Link 
                href="/community"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                커뮤니티로 돌아가기
              </Link>
            </div>
            
            {/* 상단 정보 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-semibold">{post.category}</span>
              <span className="text-xs text-gray-400">{formatDateTime(post.created_at)}</span>
              <span className="text-gray-400">•</span>
                             <div className="flex items-center gap-1">
                 <Eye className="w-4 h-4" />
                 <span className="text-sm text-gray-400">{post.view_count ?? 0}</span>
               </div>
               <span className="text-gray-400">•</span>
               <button
                 className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 transition-colors focus:outline-none border-none bg-transparent"
                 onClick={() => {
                   if (!isLoggedIn) {
                     alert('신고하려면 로그인이 필요합니다.');
                     return;
                   }
                   setIsReportModalOpen(true);
                 }}
               >
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                 </svg>
                 신고
               </button>
            </div>
                         {/* 제목 + 수정/삭제 버튼 */}
             <div className="flex items-center justify-between mb-1 gap-2">
               <div className="flex items-center gap-2 flex-1">
                 <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight break-words">{post.title}</h1>
                 {post.updated_at && (
                   <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-medium">
                     수정됨
                   </span>
                 )}
               </div>
              {(() => {
                const shouldShowEdit = isLoggedIn && String(post?.author_id) === String(user_id);
                const shouldShowDelete = isLoggedIn && (String(post?.author_id) === String(user_id) || isAdmin);
                console.log('게시글 버튼 조건:', {
                  isLoggedIn,
                  author_id: post?.author_id,
                  user_id,
                  isAdmin,
                  shouldShowEdit,
                  shouldShowDelete
                });
                return (shouldShowEdit || shouldShowDelete) ? (
                  <div className="flex items-center gap-2 ml-2">
                    {shouldShowEdit && (
                      <button
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow hover:bg-blue-700 transition-colors"
                        onClick={handleEditPost}
                      >
                        게시글 수정
                      </button>
                    )}
                    {shouldShowDelete && (
                      <button
                        className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition-colors"
                        onClick={handleDeletePost}
                      >
                        게시글 삭제
                      </button>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
            {/* 작성자 */}
            <div className="text-sm text-gray-500 mb-6 flex items-center gap-2">
              <span>by {post.author}</span>
            </div>
                                                   {/* 본문 */}
              <div className="text-base md:text-lg text-gray-900 leading-relaxed tracking-wide break-words mb-8">
                {(() => {
                  // 개선된 마크다운 렌더링 로직
                  const lines = post.content.split('\n');
                  const renderedContent = [];
                  
                  console.log('렌더링 디버깅:', {
                    전체내용: post.content,
                    분할된라인: lines,
                    라인수: lines.length
                  });
                  
                  for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    console.log(`라인 ${i}:`, line);
                    
                    // 마크다운 이미지 패턴 매칭: ![alt](imageId)
                    const imageMatch = line.match(/!\[([^\]]*)\]\((\d+)\)/);
                    if (imageMatch) {
                      const [, alt, imageId] = imageMatch;
                      console.log('이미지 매칭 성공:', { alt, imageId, line });
                      
                      renderedContent.push(
                        <div key={`img-${i}`} className="my-6">
                          <img
                            src={`/api/community/posts/images/${imageId}`}
                            alt={alt || '이미지'}
                            className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                            onError={(e) => {
                              console.error('이미지 로드 실패:', imageId, e);
                            }}
                            onLoad={() => {
                              console.log('이미지 로드 성공:', imageId);
                            }}
                          />
                        </div>
                      );
                      // 이미지 뒤에 더 많은 공간 추가 (이미지가 제대로 표시되도록)
                      renderedContent.push(
                        <div key={`img-spacer-${i}`} className="h-4"></div>
                      );
                    } else {
                      // 일반 텍스트 라인 - 공백 보존
                      if (line.length > 0) {
                        // 공백이 있어도 내용으로 간주 (의도된 공백 보존)
                        renderedContent.push(
                          <div key={`text-${i}`} className="whitespace-pre-line">
                            {line}
                          </div>
                        );
                      } else {
                        // 완전히 빈 줄은 줄바꿈으로 처리
                        renderedContent.push(
                          <div key={`empty-${i}`} className="h-4"></div>
                        );
                      }
                    }
                  }
                  
                  console.log('렌더링 결과:', renderedContent);
                  return renderedContent;
                })()}
              </div>
             

            {/* 좋아요/댓글 영역 */}
            <div className="flex items-center gap-6 mb-8">
              <button
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border font-medium transition-colors shadow-sm ${liked ? 'bg-red-100 text-red-600 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-600'}`}
                onClick={handleLike}
                disabled={!isLoggedIn || likeLoading}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-red-500' : ''}`} />
                <span>{post.like_count ?? 0}</span>
              </button>
              
            </div>
            {/* 댓글 리스트 */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                댓글
                <span className="text-sm font-normal text-gray-500">
                  ({post.comment_count ?? post.comments?.length ?? 0})
                </span>
              </h2>
              {(post.comments?.length ?? 0) === 0 ? (
                <div className="text-gray-400">아직 댓글이 없습니다.</div>
              ) : (
                <ul className="space-y-3">
                  {post.comments?.map((c) => {
                    const isReply = c.parent_id !== null;
                    const isMainComment = !isReply;
                    
                    // 메인 댓글만 렌더링하고, 대댓글은 해당 메인 댓글 아래에 표시
                    if (!isMainComment) return null;
                    
                    // 이 댓글의 대댓글들 찾기
                    const replies = post.comments?.filter(reply => reply.parent_id === c.id) || [];
                    
                    return (
                      <li key={c.id} className="space-y-2">
                        {/* 메인 댓글 */}
                        <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between">
                          <div className="flex-1">
                                                         <div className="flex items-center gap-2 mb-1">
                               <span className="font-semibold text-gray-800 text-sm">{c.author}</span>
                                                               <span className="text-xs text-gray-400">{formatDateTime(c.created_at)}</span>
                             </div>
                            <div className="text-gray-700 text-base whitespace-pre-line">{c.content}</div>
                          </div>
                          <div className="flex items-center gap-2 mt-2 md:mt-0">
                            {/* 대댓글 버튼 */}
                                                         <button
                               className="px-2 py-1 rounded bg-blue-100 text-blue-600 font-medium text-xs hover:bg-blue-200 border border-blue-200 transition-colors"
                               onClick={() => handleReplyClick(c.id)}
                             >
                               답글
                             </button>
                            {/* 삭제 버튼 */}
                            {(() => {
                              const shouldShowCommentDelete = isLoggedIn && (String(c.author_id) === String(user_id) || isAdmin);
                              return shouldShowCommentDelete ? (
                                <button
                                  className="px-3 py-1 rounded bg-red-100 text-red-600 font-medium text-xs hover:bg-red-200 border border-red-200 transition-colors"
                                  onClick={() => handleCommentDelete(c.id)}
                                >
                                  삭제
                                </button>
                              ) : null;
                            })()}
                          </div>
                        </div>
                        
                        {/* 대댓글 입력 폼 */}
                        {replyingTo === c.id && (
                          <div className="ml-6 bg-blue-50 rounded-lg p-3 border border-blue-200">
                            <form onSubmit={(e) => handleReplySubmit(e, c.id)} className="flex gap-2 items-end">
                              <textarea
                                value={replyInput}
                                onChange={e => setReplyInput(e.target.value)}
                                className="flex-1 border rounded-lg px-3 py-2 min-h-[40px] focus:ring-2 focus:ring-blue-400 focus:outline-none bg-white text-gray-900 placeholder-gray-400 resize-y text-sm"
                                placeholder={`@${c.author}님에게 답글 작성...`}
                                required
                                disabled={replySubmitting}
                              />
                              <div className="flex gap-1">
                                                                 <button
                                   type="submit"
                                   className="px-3 py-2 rounded-lg bg-blue-600 text-white font-medium text-sm shadow-md hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60"
                                   disabled={replySubmitting || !replyInput.trim()}
                                 >
                                   {replySubmitting ? '등록 중...' : '답글'}
                                 </button>
                                <button
                                  type="button"
                                  className="px-3 py-2 rounded-lg bg-gray-500 text-white font-medium text-sm shadow-md hover:bg-gray-600 transition-colors"
                                  onClick={handleCancelReply}
                                >
                                  취소
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                        
                        {/* 대댓글 목록 */}
                        {replies.length > 0 && (
                          <div className="ml-6 space-y-2">
                            {replies.map((reply) => (
                              <div key={reply.id} className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200 flex flex-col md:flex-row md:items-center md:justify-between">
                                <div className="flex-1">
                                                                     <div className="flex items-center gap-2 mb-1">
                                     <span className="font-semibold text-gray-800 text-sm">{reply.author}</span>
                                                                           <span className="text-xs text-gray-400">{formatDateTime(reply.created_at)}</span>
                                   </div>
                                  <div className="text-gray-700 text-base whitespace-pre-line">{reply.content}</div>
                                </div>
                                <div className="flex items-center gap-2 mt-2 md:mt-0">
                                  {/* 대댓글 삭제 버튼 */}
                                  {(() => {
                                    const shouldShowReplyDelete = isLoggedIn && (String(reply.author_id) === String(user_id) || isAdmin);
                                    return shouldShowReplyDelete ? (
                                      <button
                                        className="px-3 py-1 rounded bg-red-100 text-red-600 font-medium text-xs hover:bg-red-200 border border-red-200 transition-colors"
                                        onClick={() => handleCommentDelete(reply.id)}
                                      >
                                        삭제
                                      </button>
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            {/* 댓글 입력 */}
            {isLoggedIn ? (
              <form onSubmit={handleCommentSubmit} className="flex gap-2 items-end">
                <textarea
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 min-h-[48px] focus:ring-2 focus:ring-blue-400 focus:outline-none bg-gray-50 text-gray-900 placeholder-gray-400 resize-y"
                  placeholder="댓글을 입력하세요"
                  required
                  disabled={commentSubmitting}
                />
                                 <button
                   type="submit"
                   className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-60"
                   disabled={commentSubmitting || !commentInput.trim()}
                 >
                   {commentSubmitting ? '등록 중...' : '댓글 등록'}
                 </button>
              </form>
            ) : (
              <div className="text-gray-400 text-sm">댓글을 작성하려면 로그인하세요.</div>
            )}

            {/* 간소화된 게시글 목록 */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                다른 게시글 보기
              </h2>
              <RelatedPostsList currentPostId={post.id} category={post.category} />
            </div>
          </main>
        </div>
      </div>

      {/* 신고 모달 */}
      {post && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          targetType="post"
          targetId={post.id}
          targetTitle={post.title}
        />
      )}
    </>
  );
} 