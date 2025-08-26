"use client";
import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { useParams, useRouter } from 'next/navigation';
import { Star, ArrowLeft, ExternalLink, Play, MessageCircle, ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Header from '../../components/Header';
import Logo from '../../../components/Logo';
import { getCategoryLabelKo } from '@/config/aiCategories';
import SitePreviewCard from '../../components/SitePreviewCard';

interface AIService {
  id: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  rating: number;
  url: string;
  features: string[];
  pricing: string[];
  source: string;
  icon?: string;
  userCount?: number;
  videoUrl?: string;
  // 추가 필드(노션)
  koreanSupport?: boolean;
  isKoreanService?: boolean;
  apiSupport?: boolean;
  loginMethods?: string[];
  usage?: string;
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
  const [releases, setReleases] = useState<Array<{id:string;version:string;date:string;summary:string;details:string[];status?:string;url?:string}>>([]);
  const [showAllReleases, setShowAllReleases] = useState(false);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [related, setRelated] = useState<AIService[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  const extractYouTubeEmbedUrl = (text: string | undefined | null): string | null => {
    if (!text) return null;
    const ytWatch = text.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([\w-]{6,})/i);
    if (ytWatch && ytWatch[1]) return `https://www.youtube-nocookie.com/embed/${ytWatch[1]}`;
    const ytShort = text.match(/https?:\/\/(?:www\.)?youtu\.be\/([\w-]{6,})/i);
    if (ytShort && ytShort[1]) return `https://www.youtube-nocookie.com/embed/${ytShort[1]}`;
    return null;
  };

  const videoEmbedUrl = useMemo(() => {
    if (service?.videoUrl) {
      const idFromParam = extractYouTubeEmbedUrl(service.videoUrl);
      if (idFromParam) return idFromParam;
    }
    const joined = `${service?.description || ''}\n${service?.summary || ''}`;
    return extractYouTubeEmbedUrl(joined);
  }, [service?.videoUrl, service?.description, service?.summary]);

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
    const load = async () => {
      if (!params.id) return;
      try {
        const res = await fetch(`/api/ai-services/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setService(data.service || null);
        } else {
          setService(null);
        }
      } catch (e) {
        console.error('Failed to fetch service detail:', e);
        setService(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id]);

  // 관련 도구 로드(카테고리 기준 Top N)
  useEffect(() => {
    const loadRelated = async () => {
      try {
        if (!service?.category) return;
        setRelatedLoading(true);
        const qs = new URLSearchParams({ thin: '1', limit: '8', sort: 'rating', category: service.category });
        const res = await fetch(`/api/ai-services?${qs.toString()}`);
        const data = await res.json();
        const list: AIService[] = (data.services || []).filter((s: AIService) => s.id !== service.id);
        setRelated(list);
      } catch {
        setRelated([]);
      } finally {
        setRelatedLoading(false);
      }
    };
    loadRelated();
  }, [service?.id, service?.category]);

  useEffect(() => {
    const fetchReleases = async () => {
      try {
        if (!service) return;
        setReleasesLoading(true);
        const normalizeDomain = (u?: string) => {
          if (!u) return '';
          try {
            const url = new URL(u.startsWith('http') ? u : `https://${u}`);
            return url.hostname.replace(/^www\./, '').toLowerCase();
          } catch {
            return String(u).replace(/^www\./, '').toLowerCase();
          }
        };
        const q = new URLSearchParams({ 
          name: service.name || '',
          id: String(service.id || ''),
          domain: normalizeDomain(service.url || '')
        }).toString();
        const cacheKey = `releases:${service.id}`;
        const etagKey = `releasesEtag:${service.id}`;
        const inm = typeof window !== 'undefined' ? window.sessionStorage.getItem(etagKey) || '' : '';
        const res = await fetch(`/api/ai-services/${service.id}/releases?${q}`, { headers: inm ? { 'If-None-Match': inm } : {} });
        if (res.status === 304) {
          const cached = window.sessionStorage.getItem(cacheKey);
          if (cached) setReleases(JSON.parse(cached));
          return;
        }
        if (!res.ok) {
          setReleases([]);
          return;
        }
        const data = await res.json();
        const etag = res.headers.get('ETag');
        if (etag) window.sessionStorage.setItem(etagKey, etag);
        const list = data.releases || [];
        setReleases(list);
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
      } catch (e) {
        console.error('Failed to fetch releases:', e);
        setReleases([]);
      } finally {
        setReleasesLoading(false);
      }
    };
    fetchReleases();
  }, [service?.id, service?.name]);

  useEffect(() => {
    if (params.id) {
      fetchReviews();
    }
  }, [params.id, session?.user?.id]);

  // fetchServiceDetail 제거됨 (단건 API 사용)

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

  const getPricingLabel = (p: string) => (
    p === 'free' ? '무료' :
    p === 'trial' ? '무료체험' :
    p === 'paid' ? '유료' :
    p === 'partial' ? '부분유료' :
    p === 'subscription' ? '구독형태' :
    p === 'usage' ? '사용자기반' : p
  );
  const getPricingBadgeClass = (p: string) => (
    p === 'free' ? 'bg-green-100 text-green-800' :
    p === 'trial' ? 'bg-yellow-100 text-yellow-800' :
    p === 'paid' ? 'bg-red-100 text-red-800' :
    p === 'partial' ? 'bg-amber-100 text-amber-800' :
    p === 'subscription' ? 'bg-blue-100 text-blue-800' :
    p === 'usage' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'
  );
  const getCategoryLabel = (category: string) => getCategoryLabelKo(category);
  const getStatusBadgeClass = (s?: string) => {
    const t = (s || '').toLowerCase();
    if (t.includes('운영중') || t.includes('stable') || t.includes('active')) return 'bg-green-100 text-green-800';
    if (t.includes('업데이트 중단') || t.includes('deprecated')) return 'bg-yellow-100 text-yellow-800';
    if (t.includes('운영중단') || t.includes('stop') || t.includes('inactive')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-700';
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
          <Head>
            <meta name="robots" content="noindex,follow" />
          </Head>
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

  const jsonLd = service ? {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": service.name,
    "applicationCategory": service.category,
    "applicationSubCategory": service.category,
    "operatingSystem": "Web",
    "url": service.url,
    "description": service.summary || service.description,
    "aggregateRating": service.rating ? {
      "@type": "AggregateRating",
      "ratingValue": service.rating,
      "reviewCount": service.userCount || 0
    } : undefined,
    "offers": Array.isArray(service.pricing) && service.pricing.length > 0 ? {
      "@type": "Offer",
      "price": 0,
      "priceCurrency": "USD",
      "category": service.pricing.join(',')
    } : undefined
  } : null;

  const breadcrumbLd = service ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "홈",
        "item": "/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "AI 목록",
        "item": "/ai-list"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": service.name,
        "item": typeof window !== 'undefined' ? window.location.pathname : ''
      }
    ]
  } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        {jsonLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        )}
        {breadcrumbLd && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
        )}
        {service && (
          <>
            <title>{`${service.name} | 모아툴스`}</title>
            <meta name="description" content={(service.summary || service.description || '').slice(0, 160)} />
            <meta property="og:title" content={`${service.name} | 모아툴스`} />
            <meta property="og:description" content={(service.summary || service.description || '').slice(0, 200)} />
            <meta property="og:type" content="website" />
            <meta property="og:image" content={service.icon ? `/api/proxy-image?url=${encodeURIComponent(service.icon)}` : '/icon.png'} />
            <meta name="twitter:card" content="summary_large_image" />
            <link rel="canonical" href={`${process.env.NEXT_PUBLIC_BASE_URL || ''}${typeof window !== 'undefined' ? window.location.pathname : ''}`} />
            <meta name="robots" content="index,follow" />
          </>
        )}
      </Head>
      <Header />
      <div className="p-8 max-w-7xl mx-auto">
        {/* 뒤로 가기 버튼 */}
        <button
          aria-label="뒤로 가기"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          뒤로 가기
        </button>

        {/* 헤더 섹션 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Logo url={service.url} icon={service.icon} alt={`${service.name} 로고`} size={64} className="shrink-0" />
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{service.name}</h1>
              <div className="flex items-center gap-4 flex-wrap">
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
                  {getCategoryLabel(service.category)}
                </span>
                {service.koreanSupport && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">한국어 지원</span>
                )}
                {service.apiSupport && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">API 지원</span>
                )}
                {service.isKoreanService && (
                  <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">국내 서비스</span>
                )}
              </div>
            </div>
            {/* 헤더의 방문 버튼 제거 (요청사항) */}
          </div>
        </div>

        {/* 2열 레이아웃 (좌:7, 우:5) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* 좌측 컬럼: 설명, 사용 방법, 한국어 지원, 로그인, 가격, 리뷰 */}
          <div className="space-y-6 lg:col-span-7">
            {/* 도구 설명 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="text-xl font-bold text-gray-900 mb-3">도구 설명</h2>
              {service.description ? (
                <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {service.description}
                </div>
              ) : (
                <p className="text-gray-700 leading-relaxed">{service.summary}</p>
              )}
            </div>

            {/* 사용 방법 (좌측, 일반 텍스트) */}
            {service.usage && (
              <div className="bg-white rounded-lg shadow-sm p-5">
                <h2 className="text-xl font-bold text-gray-900 mb-3">사용 방법</h2>
                <div className="text-gray-800 whitespace-pre-line leading-relaxed text-[15px]">{service.usage}</div>
              </div>
            )}

            {/* 정보 섹션: 한국어 지원 / 로그인 방식 / 가격 정보 (한 행 정렬) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 한국어 지원 */}
              <div className="bg-white rounded-lg shadow-sm p-5 text-center flex flex-col gap-3 min-h-[150px]">
                <h2 className="text-xl font-bold text-gray-900 mb-3">한국어 지원</h2>
                <div className="flex flex-wrap items-center justify-center gap-2 text-gray-800 min-h-[48px]">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${service.koreanSupport ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {service.koreanSupport ? '한국어 UI/문서 지원' : '한국어 미지원'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${service.isKoreanService ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                    {service.isKoreanService ? '국내 서비스' : '해외 서비스'}
                  </span>
                </div>
              </div>

              {/* 로그인 방식 */}
              <div className="bg-white rounded-lg shadow-sm p-5 text-center flex flex-col gap-3 min-h-[150px]">
                <h2 className="text-xl font-bold text-gray-900 mb-3">로그인 방식</h2>
                {service.loginMethods && service.loginMethods.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center items-center min-h-[48px]">
                    {service.loginMethods.map((m, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">{m}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">정보 없음</p>
                )}
              </div>

              {/* 가격 정보 */}
              <div className="bg-white rounded-lg shadow-sm p-5 text-center flex flex-col gap-3 min-h-[150px]">
                <h2 className="text-xl font-bold text-gray-900 mb-3">가격 정보</h2>
                <div className="flex items-center gap-2 flex-wrap justify-center min-h-[48px]">
                  {(Array.isArray(service.pricing) ? service.pricing : [service.pricing].filter(Boolean)).map((p, index) => (
                    <span key={index} className={`px-3 py-1 rounded-full text-sm font-medium ${getPricingBadgeClass(p)}`}>
                      {getPricingLabel(p)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 리뷰 섹션 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-900">사용자 리뷰</h2>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-600">{reviews.length}개의 리뷰</span>
                </div>
              </div>

              {/* 리뷰 작성 폼 */}
              {session?.user?.id && (
                <div className="border border-gray-200 rounded-lg p-5 mb-6 bg-gray-50">
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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

          {/* 우측 컬럼: 사이트 프리뷰, 릴리즈 */}
          <div className="space-y-6 lg:col-span-5">
            {/* 공식 사이트 프리뷰 카드 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="text-xl font-bold text-gray-900 mb-3">공식 사이트</h2>
              <SitePreviewCard url={service.url} title={service.name} />
            </div>

            {/* 주요 기능 (우측) */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="text-xl font-bold text-gray-900 mb-3">주요 기능</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(service.features || []).map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Releases 섹션 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900">API 모델</h2>
                {!releasesLoading && releases.length > 0 && (
                  <span className="text-sm text-gray-500">총 {releases.length}개</span>
                )}
              </div>
              {releasesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse rounded-md border border-gray-200 p-3">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                    </div>
                  ))}
                </div>
              ) : releases.length === 0 ? (
                <p className="text-gray-500 text-sm">등록된 릴리즈가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {(showAllReleases ? releases : releases.slice(0, 5)).map((r) => (
                    <details key={r.id} className="rounded-md border border-gray-200">
                      <summary className="px-3 py-2 cursor-pointer font-medium text-gray-900">{r.version}</summary>
                      <div className="px-4 pb-3">
                        {r.summary && (
                          <p className="text-gray-700 mb-2 whitespace-pre-line">{r.summary}</p>
                        )}
                        {r.details && r.details.length > 0 && (
                          <ul className="list-disc pl-5 space-y-1 text-gray-700">
                            {r.details.map((d, i) => (<li key={i}>{d}</li>))}
                          </ul>
                        )}
                        <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
                          <span>릴리즈 일자: {r.date}</span>
                          {r.status && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(r.status)}`}>{r.status}</span>
                          )}
                        </div>
                      </div>
                    </details>
                  ))}
                  {releases.length > 5 && (
                    <button onClick={() => setShowAllReleases(v => !v)} className="w-full text-sm text-gray-600 hover:text-gray-900 py-2">
                      {showAllReleases ? '접기' : '모두 보기'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 관련 도구 */}
            <div className="bg-white rounded-lg shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold text-gray-900">관련 도구</h2>
                {!relatedLoading && related.length > 0 && (
                  <span className="text-sm text-gray-500">{related.length}개</span>
                )}
              </div>
              {relatedLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-md border border-gray-200 animate-pulse bg-gray-100" />
                  ))}
                </div>
              ) : related.length === 0 ? (
                <p className="text-gray-500 text-sm">관련 도구가 없습니다.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {related.map((r) => (
                    <a key={r.id} href={r.url ? `/ai-tool/${(() => { try { const u=new URL(r.url.startsWith('http')?r.url:`https://${r.url}`); return u.hostname.replace(/^www\./,''); } catch { return r.id; } })()}` : `/ai-tool/${r.id}`}
                       className="border border-gray-200 rounded-md p-3 hover:shadow-sm bg-white"
                       aria-label={`${r.name} 상세로 이동`}>
                      <div className="flex items-center gap-2">
                        <Logo url={r.url} icon={r.icon} alt={`${r.name} 로고`} size={24} />
                        <div className="text-sm font-medium text-gray-900 truncate">{r.name}</div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
        {/* // 2열 레이아웃 끝 */}

      </div>
    </div>
  );
} 