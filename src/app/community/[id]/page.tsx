"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Header from "../../components/Header";
import { Heart, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Post {
  id: number;
  title: string;
  content: string;
  created_at: string;
  author: string;
  category: string;
  like_count?: number;
  comment_count?: number;
  comments?: Comment[];
  liked?: boolean;
  author_id?: number;
}

interface Comment {
  id: number;
  author: string;
  content: string;
  created_at: string;
  author_id?: number;
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
  const router = useRouter();
  const [likeLoading, setLikeLoading] = useState(false);
  const isAdmin = session?.user?.role === 'ADMIN';
  
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
    console.log('게시글 데이터 요청 시작:', { postId: params.id, user_id });
    
    fetch(`/api/community/posts/${params.id}`)
      .then(res => {
        console.log('API 응답 상태:', res.status);
        return res.ok ? res.json() : null;
      })
      .then(data => {
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
        setLoading(false);
        setLiked(!!data.liked);
      })
      .catch(error => {
        console.error('게시글 데이터 요청 오류:', error);
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
  if (!post) return <div className="max-w-2xl mx-auto py-12 px-4">게시글을 찾을 수 없습니다.</div>;

  return (
    <>
      <Header />
      <div className="w-full min-h-screen bg-gray-50">
        <div className="w-full max-w-7xl flex flex-col md:flex-row gap-8 px-2 md:px-8 py-8 mx-auto">
          <main className="flex-1 min-w-0">
            {/* 상단 정보 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 font-semibold">{post.category}</span>
              <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleString()}</span>
            </div>
            {/* 제목 + 삭제 버튼 */}
            <div className="flex items-center justify-between mb-1 gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight break-words flex-1">{post.title}</h1>
              {(() => {
                const shouldShowDelete = isLoggedIn && (String(post?.author_id) === String(user_id) || isAdmin);
                console.log('게시글 삭제 버튼 조건:', {
                  isLoggedIn,
                  author_id: post?.author_id,
                  user_id,
                  isAdmin,
                  shouldShowDelete
                });
                return shouldShowDelete ? (
                  <button
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold shadow hover:bg-red-700 transition-colors ml-2"
                    onClick={handleDeletePost}
                  >
                    게시글 삭제
                  </button>
                ) : null;
              })()}
            </div>
            {/* 작성자 */}
            <div className="text-sm text-gray-500 mb-6 flex items-center gap-2">
              <span>by {post.author}</span>
            </div>
            {/* 본문 */}
            <div className="text-base md:text-lg text-gray-900 whitespace-pre-line leading-relaxed tracking-wide break-words mb-8">
              {post.content}
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
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 border border-gray-200 font-medium shadow-sm">
                <MessageCircle className="w-5 h-5" />
                <span>{post.comment_count ?? post.comments?.length ?? 0}</span>
              </div>
            </div>
            {/* 댓글 리스트 */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-3">댓글</h2>
              {(post.comments?.length ?? 0) === 0 ? (
                <div className="text-gray-400">아직 댓글이 없습니다.</div>
              ) : (
                <ul className="space-y-3">
                  {post.comments?.map((c) => (
                    <li key={c.id} className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800 text-sm">{c.author}</span>
                          <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString?.() ?? c.created_at}</span>
                        </div>
                        <div className="text-gray-700 text-base whitespace-pre-line">{c.content}</div>
                      </div>
                      {(() => {
                        const shouldShowCommentDelete = isLoggedIn && (String(c.author_id) === String(user_id) || isAdmin);
                        console.log('댓글 삭제 버튼 조건:', {
                          commentId: c.id,
                          isLoggedIn,
                          commentAuthor_id: c.author_id,
                          user_id,
                          isAdmin,
                          shouldShowCommentDelete
                        });
                        return shouldShowCommentDelete ? (
                          <button
                            className="mt-2 md:mt-0 md:ml-4 px-3 py-1 rounded bg-red-100 text-red-600 font-medium text-xs hover:bg-red-200 border border-red-200 transition-colors"
                            onClick={() => handleCommentDelete(c.id)}
                          >
                            삭제
                          </button>
                        ) : null;
                      })()}
                    </li>
                  ))}
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
          </main>
        </div>
      </div>
    </>
  );
} 