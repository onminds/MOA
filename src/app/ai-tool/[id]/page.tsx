<<<<<<< HEAD
"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Star, ArrowLeft, ExternalLink, Play, MessageCircle, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Header from '../../components/Header';

interface AIService {
  id: number;
  name: string;
  description: string;
  category: string;
  rating: number;
  url: string;
  features: string[];
  pricing: string;
  source: string;
  icon?: string;
  userCount?: number;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
  notHelpful: number;
  userVote?: string;
}

export default function AIToolDetail() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [service, setService] = useState<AIService | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    if (params.id) {
      fetchServiceDetail();
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      fetchReviews();
    }
  }, [params.id, session?.user?.id]);

  const fetchServiceDetail = async () => {
    try {
      const response = await fetch('/api/ai-services');
      const data = await response.json();
      const foundService = data.services.find((s: AIService) => s.id === parseInt(params.id as string));
      setService(foundService || null);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch service:', error);
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/reviews/${params.id}`, {
        headers: {
          'Authorization': `Bearer ${session?.user?.id || ''}`
        }
      });
      const data = await response.json();
      console.log('리뷰 데이터:', data.reviews); // 디버깅용
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      setReviews([]);
    }
  };

  const handleSubmitReview = async () => {
    if (!session?.user?.id) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (userRating === 0) {
      alert('평점을 선택해주세요.');
      return;
    }

    if (!userComment.trim()) {
      alert('리뷰 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/reviews/${params.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.id}`
        },
        body: JSON.stringify({
          rating: userRating,
          comment: userComment.trim()
        })
      });

      if (response.ok) {
        setUserRating(0);
        setUserComment('');
        await fetchReviews(); // 리뷰 목록 새로고침
        alert('리뷰가 등록되었습니다.');
      } else {
        const errorData = await response.json();
        alert(errorData.error || '리뷰 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('리뷰 등록 오류:', error);
      alert('리뷰 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHelpful = async (reviewId: string, isHelpful: boolean) => {
    if (!session?.user?.id) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${params.id}/${reviewId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.id}`
        },
        body: JSON.stringify({
          action: isHelpful ? 'helpful' : 'notHelpful'
        })
      });

      if (response.ok) {
        await fetchReviews(); // 리뷰 목록 새로고침
      } else {
        const errorData = await response.json();
        alert(errorData.error || '투표에 실패했습니다.');
      }
    } catch (error) {
      console.error('투표 오류:', error);
      alert('투표 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!session?.user?.id) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!confirm('정말로 이 리뷰를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/reviews/${params.id}/${reviewId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.user.id}`
        }
      });

      if (response.ok) {
        await fetchReviews(); // 리뷰 목록 새로고침
        alert('리뷰가 삭제되었습니다.');
      } else {
        const errorData = await response.json();
        alert(errorData.error || '리뷰 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('리뷰 삭제 오류:', error);
      alert('리뷰 삭제 중 오류가 발생했습니다.');
    }
  };

  const renderStars = (rating: number, interactive = false, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            onClick={interactive && onRatingChange ? () => onRatingChange(star) : undefined}
            className={`${interactive ? 'cursor-pointer' : 'cursor-default'}`}
            disabled={!interactive}
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-200 rounded mb-4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">도구를 찾을 수 없습니다</h1>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              뒤로 가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="p-8">
        {/* 뒤로 가기 버튼 */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          뒤로 가기
        </button>

        {/* 헤더 섹션 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            {service.icon ? (
              <img
                src={service.icon}
                alt={`${service.name} icon`}
                className="w-16 h-16 object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{service.name}</h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {renderStars(service.rating)}
                  <span className="text-lg font-semibold text-gray-900">{service.rating}</span>
                </div>
                {service.userCount && (
                  <div className="flex items-center gap-1 text-gray-600">
                    <span>👥</span>
                    <span className="font-medium">
                      {service.userCount >= 1000000
                        ? `${(service.userCount / 1000000).toFixed(1)}M`
                        : service.userCount >= 1000
                        ? `${(service.userCount / 1000).toFixed(1)}K`
                        : service.userCount}
                    </span>
                  </div>
                )}
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {service.category}
                </span>
              </div>
            </div>
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              공식 사이트 방문
            </a>
          </div>
        </div>

        {/* 공식 설명 영상 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">공식 설명 영상</h2>
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            {showVideo ? (
              <div className="aspect-video">
                <iframe
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                  title={`${service.name} 공식 영상`}
                  className="w-full h-full"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video bg-gray-800 flex items-center justify-center">
                <button
                  onClick={() => setShowVideo(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Play className="w-5 h-5" />
                  영상 보기
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 도구 설명 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">도구 설명</h2>
          <p className="text-gray-700 leading-relaxed">{service.description}</p>
        </div>

        {/* 주요 기능 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">주요 기능</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {service.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 가격 정보 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">가격 정보</h2>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              {service.pricing}
            </span>
          </div>
        </div>

        {/* 리뷰 섹션 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">사용자 리뷰</h2>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-gray-500" />
              <span className="text-gray-600">{reviews.length}개의 리뷰</span>
            </div>
          </div>

          {/* 리뷰 작성 폼 */}
          {session?.user?.id && (
            <div className="border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">리뷰 작성</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">평점</label>
                  {renderStars(userRating, true, setUserRating)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">리뷰 내용</label>
                  <textarea
                    value={userComment}
                    onChange={(e) => setUserComment(e.target.value)}
                    placeholder="이 도구에 대한 경험을 공유해주세요..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                  />
                </div>
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {isSubmitting ? '등록 중...' : '리뷰 등록'}
                </button>
              </div>
            </div>
          )}

          {/* 리뷰 목록 */}
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700">
                        {review.userName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{review.userName}</div>
                      <div className="flex items-center gap-2">
                        {renderStars(review.rating)}
                        <span className="text-sm text-gray-500">{review.date}</span>
                      </div>
                    </div>
                  </div>
                  {session?.user?.id === review.userId && (
                    <button
                      onClick={() => handleDeleteReview(review.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-gray-700 mb-3">{review.comment}</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleHelpful(review.id, true)}
                    className={`flex items-center gap-1 text-sm ${
                      review.userVote === 'helpful' ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    도움됨 ({review.helpful})
                  </button>
                  <button
                    onClick={() => handleHelpful(review.id, false)}
                    className={`flex items-center gap-1 text-sm ${
                      review.userVote === 'notHelpful' ? 'text-red-600' : 'text-gray-500 hover:text-red-600'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    도움안됨 ({review.notHelpful})
                  </button>
                </div>
              </div>
            ))}
          </div>

          {reviews.length === 0 && (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">아직 리뷰가 없습니다.</p>
              <p className="text-gray-400 text-sm">첫 번째 리뷰를 작성해보세요!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
=======
"use client";
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Star, ArrowLeft, ExternalLink, Play, MessageCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';

interface AIService {
  id: number;
  name: string;
  description: string;
  category: string;
  rating: number;
  url: string;
  features: string[];
  pricing: string;
  source: string;
  icon?: string;
  userCount?: number;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
  notHelpful: number;
}

export default function AIToolDetail() {
  const params = useParams();
  const router = useRouter();
  const [service, setService] = useState<AIService | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchServiceDetail();
      fetchReviews();
    }
  }, [params.id]);

  const fetchServiceDetail = async () => {
    try {
      const response = await fetch('/api/ai-services');
      const data = await response.json();
      const foundService = data.services.find((s: AIService) => s.id === parseInt(params.id as string));
      setService(foundService || null);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch service:', error);
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/reviews/${params.id}`);
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      setReviews([]);
    }
  };

  const handleSubmitReview = async () => {
    if (!userRating || !userComment.trim()) {
      alert('별점과 리뷰를 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/reviews/${params.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: userRating,
          comment: userComment,
          userName: '사용자'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(prev => [data.review, ...prev]);
        setUserRating(0);
        setUserComment('');
      } else {
        alert('리뷰 제출에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
      alert('리뷰 제출에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHelpful = async (reviewId: string, isHelpful: boolean) => {
    try {
      const response = await fetch(`/api/reviews/${params.id}/${reviewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isHelpful }),
      });

      if (response.ok) {
        const data = await response.json();
        setReviews(prev => prev.map(review => 
          review.id === reviewId ? data.review : review
        ));
      }
    } catch (error) {
      console.error('Failed to update review:', error);
    }
  };

  const renderStars = (rating: number, interactive = false, onRatingChange?: (rating: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => interactive && onRatingChange?.(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            disabled={!interactive}
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating
                  ? 'text-yellow-400 fill-current'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded mb-4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 p-8">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">도구를 찾을 수 없습니다</h1>
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                뒤로 가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 p-8">
          {/* 뒤로 가기 버튼 */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            뒤로 가기
          </button>

          {/* 헤더 섹션 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              {service.icon ? (
                <img
                  src={service.icon}
                  alt={`${service.name} icon`}
                  className="w-16 h-16 object-contain rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{service.name}</h1>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {renderStars(service.rating)}
                    <span className="text-lg font-semibold text-gray-900">{service.rating}</span>
                  </div>
                  {service.userCount && (
                    <div className="flex items-center gap-1 text-gray-600">
                      <span>👥</span>
                      <span className="font-medium">
                        {service.userCount >= 1000000
                          ? `${(service.userCount / 1000000).toFixed(1)}M`
                          : service.userCount >= 1000
                          ? `${(service.userCount / 1000).toFixed(1)}K`
                          : service.userCount}
                      </span>
                    </div>
                  )}
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {service.category}
                  </span>
                </div>
              </div>
              <a
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                공식 사이트 방문
              </a>
            </div>
          </div>

          {/* 공식 설명 영상 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">공식 설명 영상</h2>
            <div className="relative bg-gray-900 rounded-lg overflow-hidden">
              {showVideo ? (
                <div className="aspect-video">
                  <iframe
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title={`${service.name} 공식 영상`}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="aspect-video bg-gray-800 flex items-center justify-center">
                  <button
                    onClick={() => setShowVideo(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Play className="w-5 h-5" />
                    영상 보기
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 도구 설명 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">도구 설명</h2>
            <p className="text-gray-700 leading-relaxed mb-4">{service.description}</p>
            <div className="flex flex-wrap gap-2">
              {service.features.map((feature, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium"
                >
                  {feature}
                </span>
              ))}
            </div>
          </div>

          {/* 플랫폼 운영자 리뷰 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 mb-6 border-l-4 border-blue-500">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">플랫폼 운영자 리뷰</h2>
                <p className="text-sm text-gray-600">AI 도구 전문가의 상세 분석</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-2">💡 핵심 특징</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {service.name}는 {service.category} 분야에서 뛰어난 성능을 보여주는 도구입니다. 
                  {service.features.slice(0, 3).join(', ')} 등의 기능을 통해 사용자들에게 실질적인 가치를 제공하고 있으며, 
                  {service.rating}점의 높은 평점은 사용자들의 만족도를 반영합니다.
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-2">🎯 추천 사용 사례</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {service.category === '챗봇' && '자연어 처리와 대화형 AI가 필요한 모든 분야에서 활용 가능합니다. 특히 문서 작성, 코드 개발, 학습 보조 등에 효과적입니다.'}
                  {service.category === '이미지 생성' && '창작 활동, 디자인 작업, 마케팅 자료 제작 등에서 활용할 수 있습니다. 예술적 표현과 실용적 이미지 생성 모두 지원합니다.'}
                  {service.category === '개발' && '소프트웨어 개발 전 과정에서 활용 가능하며, 특히 코드 작성, 디버깅, 문서화 등에서 개발 생산성을 크게 향상시킵니다.'}
                  {service.category === '검색' && '정보 검색과 분석이 필요한 모든 분야에서 활용할 수 있으며, 특히 연구, 학습, 비즈니스 의사결정 등에 유용합니다.'}
                  {service.category === '생산성' && '업무 효율성 향상과 자동화가 필요한 모든 분야에서 활용 가능하며, 문서 작성, 데이터 분석, 업무 프로세스 개선 등에 효과적입니다.'}
                  {service.category === '글쓰기' && '콘텐츠 제작, 마케팅, 교육 등 다양한 분야에서 활용할 수 있으며, 특히 글쓰기 품질 향상과 시간 절약에 도움이 됩니다.'}
                  {service.category === '디자인' && '시각적 디자인 작업, 브랜딩, 마케팅 자료 제작 등에서 활용할 수 있으며, 창의적 표현과 실용적 디자인 모두 지원합니다.'}
                  {service.category === 'AI 플랫폼' && 'AI 모델 개발, 연구, 실험 등에서 활용할 수 있으며, 다양한 AI 기술을 통합하고 테스트하는 데 유용합니다.'}
                  {service.category === '비디오' && '영상 제작, 편집, 마케팅 콘텐츠 등에서 활용할 수 있으며, 특히 AI 기반 영상 생성과 편집에 특화되어 있습니다.'}
                  {service.category === '음성' && '음성 인식, 음성 합성, 음성 분석 등에서 활용할 수 있으며, 특히 접근성 향상과 음성 기반 인터페이스 개발에 유용합니다.'}
                  {service.category === '음악' && '음악 작곡, 편집, 생성 등에서 활용할 수 있으며, 특히 AI 기반 음악 창작과 프로덕션에 특화되어 있습니다.'}
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-2">⚡ 성능 평가</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">사용자 만족도:</span>
                    <div className="flex items-center gap-1 mt-1">
                      {renderStars(service.rating)}
                      <span className="text-gray-600">({service.rating}/5)</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">시장 점유율:</span>
                    <div className="mt-1">
                      <span className="text-gray-600">
                        {service.userCount && service.userCount >= 50000000 ? '매우 높음' : 
                         service.userCount && service.userCount >= 20000000 ? '높음' : 
                         service.userCount && service.userCount >= 10000000 ? '보통' : '낮음'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">기술 혁신성:</span>
                    <div className="mt-1">
                      <span className="text-gray-600">
                        {service.rating >= 4.5 ? '매우 높음' : service.rating >= 4.0 ? '높음' : '보통'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">가격 대비 성능:</span>
                    <div className="mt-1">
                      <span className="text-gray-600">
                        {service.pricing === 'Free' ? '매우 좋음' : 
                         service.pricing === 'Freemium' ? '좋음' : '보통'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-2">💼 비즈니스 가치</h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {service.name}는 {service.pricing === 'Free' ? '무료로 제공되어 접근성이 뛰어나며, ' : 
                   service.pricing === 'Freemium' ? '프리미엄 모델로 기본 기능은 무료이며, ' :
                   '유료 서비스로 전문적인 기능을 제공하며, '}
                  {service.category} 분야에서 경쟁력 있는 솔루션을 제공합니다. 
                  {service.userCount && `${(service.userCount / 1000000).toFixed(1)}M`}명의 사용자가 선택한 도구로서 
                  검증된 신뢰성과 안정성을 보여주고 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 사용자 리뷰 섹션 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">사용자 리뷰</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">평균 평점:</span>
                {renderStars(service.rating)}
                <span className="font-semibold text-gray-900">{service.rating}</span>
              </div>
            </div>

            {/* 리뷰 작성 폼 */}
            <div className="border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">리뷰 작성</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">별점</label>
                {renderStars(userRating, true, setUserRating)}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">리뷰</label>
                <textarea
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="이 도구에 대한 경험을 공유해주세요..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={4}
                />
              </div>
              <button
                onClick={handleSubmitReview}
                disabled={isSubmitting || !userRating || !userComment.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '제출 중...' : '리뷰 제출'}
              </button>
            </div>

            {/* 리뷰 목록 */}
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{review.userName}</span>
                      <span className="text-sm text-gray-500">{review.date}</span>
                    </div>
                    {renderStars(review.rating)}
                  </div>
                  <p className="text-gray-700 mb-3">{review.comment}</p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleHelpful(review.id, true)}
                      className="flex items-center gap-1 text-gray-600 hover:text-green-600"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span className="text-sm">도움됨 ({review.helpful})</span>
                    </button>
                    <button
                      onClick={() => handleHelpful(review.id, false)}
                      className="flex items-center gap-1 text-gray-600 hover:text-red-600"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span className="text-sm">도움안됨 ({review.notHelpful})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
} 