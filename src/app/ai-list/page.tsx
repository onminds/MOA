"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Head from 'next/head';
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from '../components/Header';
import { cachedFetchJson } from '@/lib/client-utils';
import { 
  Search, Star, ExternalLink, Filter, Grid, List as ListIcon, Heart, Share2, Download,
  MessageCircle, Users, TrendingUp, Zap, Brain, Palette, Music, Video, FileText, Globe
} from 'lucide-react';
import Logo from '../../components/Logo';
import { getCategoryLabelKo } from '@/config/aiCategories';

interface AIService {
  pageId?: string;
  id: string; // unique_id는 문자열이므로 string으로 변경
  name: string;
  summary: string; // 한줄평
  description: string; // 상세 설명
  category: string;
  rating: number; // DB에서 가져올 예정
  url: string;
  icon?: string;
  features: string[]; // '태그' (multi-select)
  pricing: string[]; // '가격 형태' (multi-select)
  source: string; // 'Notion DB'로 고정값 설정 예정
  userCount?: number; // Notion에 없으므로 선택적

  // Notion의 추가 속성들
  koreanSupport: boolean;
  isKoreanService: boolean;
  apiSupport: boolean;
  loginMethods: string[]; // '로그인 방식' (multi-select)
}

export default function AIList() {
  const router = useRouter();
  const [filteredServices, setFilteredServices] = useState<AIService[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPricing, setSelectedPricing] = useState('all');
  const [sortBy, setSortBy] = useState('rating');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagList, setShowTagList] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<Array<{tag: string, count: number}>>([]);
  
  // 페이지네이션 상태 추가
  const [currentPage, setCurrentPage] = useState(1);
  const hasSyncedFromUrlRef = useRef(false);
  const isRestoringRef = useRef(false);
  const [itemsPerPage] = useState(20);
  const [servicesCache, setServicesCache] = useState<AIService[]>([]);
  const [resultFallback, setResultFallback] = useState<'none' | 'relaxed' | 'keyword' | null>(null);
  const scrollSavedRef = useRef(false);
  const inflightIdRef = useRef(0);
  const initialLoadedRef = useRef(false);

  const categories = [
    { id: 'all', name: '전체' },
    { id: 'chat', name: '채팅/대화' },
    { id: 'image', name: '이미지 생성' },
    { id: 'video', name: '영상 생성' },
    { id: 'audio', name: '음성/음악' },
    { id: 'avatar', name: '아바타/디지털휴먼' },
    { id: 'writing', name: '글쓰기' },
    { id: 'coding', name: '코딩' },
    { id: 'productivity', name: '생산성' }
  ];

  const pricingOptions = [
    { id: 'all', name: '전체' },
    { id: 'free', name: '무료' },
    { id: 'trial', name: '무료체험' },
    { id: 'paid', name: '유료' },
    { id: 'partial', name: '부분유료' },
    { id: 'subscription', name: '구독형태' },
    { id: 'usage', name: '사용자기반' }
  ];

  const sortOptions = [
    { id: 'rating', name: '평점순' },
    { id: 'name', name: '이름순' },
    { id: 'users', name: '사용자순' }
  ];

  // 서버에서 페이지 단위로 데이터 로드 (초기 복원 이후에만)
  useEffect(() => {
    if (!ready) return;
    fetchServices();
  }, [ready, currentPage, debouncedQuery, selectedCategory, selectedPricing, sortBy, selectedTags]);

  // 페이지 변경 시 스켈레톤 표시를 위해 loading 플래그를 즉시 true로 설정
  useEffect(() => {
    if (!ready) return;
    setLoading(true);
  }, [currentPage, debouncedQuery, selectedCategory, selectedPricing, sortBy, selectedTags, ready]);

  // 검색어 디바운스 (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // 총 페이지 수 계산 (서버 total 기반)
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  // 최초 마운트 시 URL/세션에서 페이지 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { if ('scrollRestoration' in window.history) { window.history.scrollRestoration = 'manual'; } } catch {}
    const url = new URL(window.location.href);
    const param = url.searchParams.get('page');
    const paramNum = parseInt(param || '', 10);
    if (!Number.isNaN(paramNum) && paramNum > 0) {
      isRestoringRef.current = true;
      setCurrentPage(paramNum);
      setTimeout(() => { isRestoringRef.current = false; }, 0);
      hasSyncedFromUrlRef.current = true;
      // 스크롤 복원
      const savedY = parseInt(window.sessionStorage.getItem('ai-list:scrollY') || '', 10);
      if (!Number.isNaN(savedY)) { window.scrollTo({ top: savedY, behavior: 'instant' as ScrollBehavior }); }
      // 초기 필터 동기화
      const q = url.searchParams.get('q') || '';
      const cat = url.searchParams.get('category') || 'all';
      const pri = url.searchParams.get('pricing') || 'all';
      const srt = url.searchParams.get('sort') || 'rating';
      const tgs = (url.searchParams.get('tags') || '').split(',').map(t => t.trim()).filter(Boolean);
      setSearchQuery(q);
      setDebouncedQuery(q);
      setSelectedCategory(cat);
      setSelectedPricing(pri);
      setSortBy(srt as any);
      if (tgs.length > 0) setSelectedTags(Array.from(new Set(tgs)).sort((a,b)=>a.localeCompare(b)));
      setReady(true);
      return;
    }
    const saved = window.sessionStorage.getItem('ai-list:page');
    const savedNum = parseInt(saved || '', 10);
    if (!Number.isNaN(savedNum) && savedNum > 0) {
      isRestoringRef.current = true;
      setCurrentPage(savedNum);
      setTimeout(() => { isRestoringRef.current = false; }, 0);
    }
    hasSyncedFromUrlRef.current = true;
    const savedY = parseInt(window.sessionStorage.getItem('ai-list:scrollY') || '', 10);
    if (!Number.isNaN(savedY)) { window.scrollTo({ top: savedY, behavior: 'instant' as ScrollBehavior }); }
    // 초기 필터 동기화(없으면 기본값 유지)
    const q = url.searchParams.get('q') || '';
    const cat = url.searchParams.get('category') || 'all';
    const pri = url.searchParams.get('pricing') || 'all';
    const srt = url.searchParams.get('sort') || 'rating';
    const tgs = (url.searchParams.get('tags') || '').split(',').map(t => t.trim()).filter(Boolean);
    if (q) { setSearchQuery(q); setDebouncedQuery(q); }
    if (cat) setSelectedCategory(cat);
    if (pri) setSelectedPricing(pri);
    if (srt) setSortBy(srt as any);
    if (tgs.length > 0) setSelectedTags(Array.from(new Set(tgs)).sort((a,b)=>a.localeCompare(b)));
    setReady(true);
  }, []);

  // 페이지 변경 시(URL과 세션 저장). 초기 동기화 전에는 쓰지 않음
  useEffect(() => {
    if (typeof window !== 'undefined' && hasSyncedFromUrlRef.current) {
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(currentPage));
      const nextHref = `${url.pathname}?${url.searchParams.toString()}`;
      try {
        if (isRestoringRef.current) {
          // 초기 복원 시에는 replace로 기록만 갱신
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (router as any).replace?.(nextHref, { scroll: false });
        } else {
          // 사용자가 페이지 버튼을 눌러 이동한 경우 push로 히스토리 남김
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (router as any).push?.(nextHref, { scroll: false });
        }
      } catch {
        // fallback
        if (isRestoringRef.current) {
          window.history.replaceState({}, '', nextHref);
        } else {
          window.history.pushState({}, '', nextHref);
        }
      }
      window.sessionStorage.setItem('ai-list:page', String(currentPage));
    }
  }, [currentPage]);

  // 브라우저 뒤로가기/앞으로가기(popstate) 및 BFCache 복원(pageshow) 대응
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => {
      const url = new URL(window.location.href);
      const param = url.searchParams.get('page');
      const num = parseInt(param || '', 10);
      if (!Number.isNaN(num) && num > 0) {
        setCurrentPage(num);
      } else {
        const saved = window.sessionStorage.getItem('ai-list:page');
        const savedNum = parseInt(saved || '', 10);
        if (!Number.isNaN(savedNum) && savedNum > 0) {
          setCurrentPage(savedNum);
        } else {
          setCurrentPage(1);
        }
      }
    };

    const onPopState = () => { syncFromUrl();
      const savedY = parseInt(window.sessionStorage.getItem('ai-list:scrollY') || '', 10);
      if (!Number.isNaN(savedY)) { window.scrollTo({ top: savedY, behavior: 'instant' as ScrollBehavior }); }
    };
    const onPageShow = () => { syncFromUrl();
      const savedY = parseInt(window.sessionStorage.getItem('ai-list:scrollY') || '', 10);
      if (!Number.isNaN(savedY)) { window.scrollTo({ top: savedY, behavior: 'instant' as ScrollBehavior }); }
    };
    const onPageHide = () => {
      try {
        window.sessionStorage.setItem('ai-list:page', String(currentPage));
        window.sessionStorage.setItem('ai-list:scrollY', String(window.scrollY));
      } catch {}
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onPageHide);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onPageHide);
    };
  }, [currentPage]);

  // 현재 페이지 변경 시 스크롤 위치 저장
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      if (!scrollSavedRef.current) {
        try {
          window.sessionStorage.setItem('ai-list:scrollY', String(window.scrollY));
        } catch {}
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [currentPage]);

  // 필터/검색 변경 시 페이지 1로 이동 (초기 동기화 이후, 디바운스 검색 기준)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setCurrentPage(1);
  }, [ready, debouncedQuery, selectedCategory, selectedPricing, sortBy, selectedTags]);

  const fetchServices = async () => {
    try {
      const myId = ++inflightIdRef.current;
      setLoading(true);
      // 페이지 전환/필터 변경 시 이전 목록을 즉시 비워 사용자에게 변화가 시작됐음을 명확히 전달
      if (initialLoadedRef.current) {
        setFilteredServices([]);
      }
      const params = new URLSearchParams();
      params.set('thin', '1');
      params.set('source', 'sql');
      params.set('page', String(currentPage));
      params.set('limit', String(itemsPerPage));
      const qn = (debouncedQuery || '').trim();
      if (qn) params.set('q', qn);
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedPricing && selectedPricing !== 'all') params.set('pricing', selectedPricing);
      if (sortBy) params.set('sort', sortBy);
      if (selectedTags.length > 0) {
        const normalizedTags = Array.from(new Set(selectedTags.map(t => t.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
        params.set('tags', normalizedTags.join(','));
      }

      const url = `/api/ai-services?${params.toString()}`;
      const cacheKey = `ai-services:v3:${params.toString()}`;
      const response = await cachedFetchJson(url, cacheKey);
      if (myId !== inflightIdRef.current) return; // stale 응답 무시
      const data = response.services || [];
      const total = Number(response.total || 0);
      const fb = (response.fallback || 'none') as 'none' | 'relaxed' | 'keyword';

      setFilteredServices(data);
      setTotalCount(total);
      setResultFallback(fb);
      initialLoadedRef.current = true;
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      setLoading(false);
    }
  };


  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'chat': return <MessageCircle className="w-5 h-5" />;
      case 'image': return <Palette className="w-5 h-5" />;
      case 'video': return <Video className="w-5 h-5" />;
      case 'audio': return <Music className="w-5 h-5" />;
      case 'writing': return <FileText className="w-5 h-5" />;
      case 'coding': return <Zap className="w-5 h-5" />;
      case 'productivity': return <Brain className="w-5 h-5" />;
      default: return <Globe className="w-5 h-5" />;
    }
  };

  const getPricingBadge = (pricing: string) => {
    switch (pricing) {
      case 'free':
        return '무료';
      case 'trial':
        return '무료체험';
      case 'paid':
        return '유료';
      case 'partial':
        return '부분유료';
      case 'subscription':
        return '구독형태';
      case 'usage':
        return '사용자기반';
      default:
        return pricing;
    }
  };

  const getCategoryLabel = (category: string) => getCategoryLabelKo(category);

  const getPricingBadgeClass = (p: string) => (
    `inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ` +
    (
      p === 'free' ? 'border-green-300 text-green-700 bg-green-50' :
      p === 'trial' ? 'border-yellow-300 text-yellow-700 bg-yellow-50' :
      p === 'paid' ? 'border-rose-300 text-rose-700 bg-rose-50' :
      p === 'partial' ? 'border-amber-300 text-amber-700 bg-amber-50' :
      p === 'subscription' ? 'border-blue-300 text-blue-700 bg-blue-50' :
      p === 'usage' ? 'border-purple-300 text-purple-700 bg-purple-50' :
      'border-gray-300 text-gray-700 bg-gray-50'
    )
  );

  // 현재 페이지를 기준으로 페이지 버튼 윈도우 생성 (최대 5개)
  const getPageNumbers = () => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handleServiceClick = (service: AIService) => {
    const toDomain = (u: string) => {
      try {
        const urlObj = new URL(u.startsWith('http') ? u : `https://${u}`);
        return urlObj.hostname.replace(/^www\./, '');
      } catch {
        return u;
      }
    };
    const pathId = service.url ? toDomain(service.url) : service.id;
    router.push(`/ai-tool/${pathId}`);
  };

  const formatUserCount = (userCount?: number) => {
    if (!userCount) return '';
    if (userCount >= 1000000) {
      return `${(userCount / 1000000).toFixed(1)}M`;
    } else if (userCount >= 1000) {
      return `${(userCount / 1000).toFixed(1)}K`;
    }
    return userCount.toString();
  };

  const getAllTags = () => {
    const allTags = new Map<string, number>();
    filteredServices.forEach(service => {
      (Array.isArray(service.features) ? service.features : []).forEach(feature => {
        const words = feature.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 2) {
            allTags.set(word, (allTags.get(word) || 0) + 1);
          }
        });
      });
    });
    return Array.from(allTags.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
  };

  const generateTagSuggestions = (query: string) => {
    if (!query.startsWith('#')) return [];
    
    const tagQuery = query.slice(1).toLowerCase();
    const allTags = getAllTags();
    
    return allTags
      .filter(item => item.tag.includes(tagQuery))
      .slice(0, 10);
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (value.includes('#')) {
      const suggestions = generateTagSuggestions(value);
      setTagSuggestions(suggestions);
      setShowTagSuggestions(suggestions.length > 0);
    } else {
      setShowTagSuggestions(false);
    }
  };

  const handleTagSelect = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setSearchQuery('');
    setShowTagSuggestions(false);
  };

  const handleTagRemove = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  if (loading && !initialLoadedRef.current) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "AI Tools List",
            "itemListElement": filteredServices.map((svc, idx) => ({
              "@type": "ListItem",
              "position": idx + 1,
              "item": {
                "@type": "SoftwareApplication",
                "name": svc.name,
                "url": svc.url,
                "applicationCategory": svc.category,
                "aggregateRating": svc.rating ? {
                  "@type": "AggregateRating",
                  "ratingValue": svc.rating,
                  "reviewCount": svc.userCount || 0
                } : undefined
              }
            }))
          }) }}
        />
      </Head>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-8">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AI 도구 목록</h1>
            <p className="text-gray-800 font-semibold">최고의 AI 도구들을 발견하고 비교해보세요</p>
          </div>

          {/* 검색 및 필터 */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            {/* 상단: 검색, 태그추가, 카테고리, 플랜, 표시방법 */}
            <div className="flex flex-wrap gap-3 items-center mb-4">
              {/* 검색 */}
              <div className="flex-1 min-w-[300px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="AI 도구 검색... #을 입력하여 태그 검색"
                    value={searchQuery}
                    onChange={handleSearchInput}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-700 text-gray-900"
                  />
                  
                  {/* 태그 제안 */}
                  {showTagSuggestions && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-lg shadow-lg z-10 mt-1">
                      {tagSuggestions.map((item, index) => (
                        <div
                          key={index}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-900"
                          onClick={() => handleTagSelect(item.tag)}
                        >
                          #{item.tag} ({item.count}개)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 태그 추가 버튼 */}
              <button
                onClick={() => setShowTagList(!showTagList)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
              >
                <span>+</span>
                태그 추가
              </button>

              {/* 카테고리 필터 */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 font-medium w-32"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id} className="text-gray-800 font-medium">
                    {category.name}
                  </option>
                ))}
              </select>

              {/* 플랜(가격) 필터 */}
              <select
                value={selectedPricing}
                onChange={(e) => setSelectedPricing(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 font-medium w-32"
              >
                {pricingOptions.map(option => (
                  <option key={option.id} value={option.id} className="text-gray-800 font-medium">
                    {option.name}
                  </option>
                ))}
              </select>

              {/* 정렬 기준 */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 font-medium w-32"
              >
                {sortOptions.map(option => (
                  <option key={option.id} value={option.id} className="text-gray-800 font-medium">
                    {option.name}
                  </option>
                ))}
              </select>

              {/* 표시방법(뷰 모드) */}
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 선택된 태그들 */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    #{tag}
                    <button
                      onClick={() => handleTagRemove(tag)}
                      className="ml-1 hover:text-blue-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 태그 목록 */}
            {showTagList && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">인기 태그</h3>
                <div className="flex flex-wrap gap-2">
                  {getAllTags().slice(0, 20).map((item, index) => (
                    <button
                      key={index}
                      onClick={() => handleTagSelect(item.tag)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                    >
                      #{item.tag}
                      <span className="text-xs text-gray-500">
                        {(() => {
                          const getCountDisplay = (count: number) => {
                            if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
                            return count.toString();
                          };
                          return getCountDisplay(item.count);
                        })()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 결과 통계 */}
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <p className="text-gray-600">
              총 <span className="font-semibold text-gray-900">{totalCount}</span>개의 AI 도구를 찾았습니다
            </p>
            {resultFallback && resultFallback !== 'none' && (
              <span
                className={
                  `inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ` +
                  (resultFallback === 'relaxed'
                    ? 'border-amber-300 text-amber-700 bg-amber-50'
                    : 'border-indigo-300 text-indigo-700 bg-indigo-50')
                }
                title={resultFallback === 'relaxed' ? '조건을 완화해 유사한 결과를 추천합니다' : '키워드 유사도를 기준으로 추천합니다'}
              >
                {resultFallback === 'relaxed' ? '추천 결과(필터 완화)' : '추천 결과(키워드)'}
              </span>
            )}
          </div>

          {/* AI 도구 목록 */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredServices.map((service) => (
                <Link
                  key={service.id}
                  href={service.url ? `/ai-tool/${(() => { try { const u=new URL(service.url.startsWith('http')?service.url:`https://${service.url}`); return u.hostname.replace(/^www\./,''); } catch { return service.id; } })()}` : `/ai-tool/${service.id}`}
                  aria-label={`${service.name} 상세 보기`}
                  className="block bg-white rounded-lg p-6 border border-gray-300 ring-1 ring-gray-200 shadow-md hover:shadow-lg hover:ring-blue-200 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500 hover:-translate-y-0.5 transform"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Logo url={service.url} icon={service.icon} alt={`${service.name} 로고`} size={40} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-lg">{service.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600 ml-1">{service.rating}</span>
                          </div>
                          {service.userCount && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Users className="w-4 h-4 mr-1" />
                              {formatUserCount(service.userCount)}
                            </div>
                          )}
                        </div>
                        {/* 카테고리/가격 배지 */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className={getPricingBadgeClass('other')}>
                            {getCategoryLabel(service.category)}
                          </span>
                          {(Array.isArray(service.pricing) ? service.pricing : [service.pricing].filter(Boolean)).map((p, index) => (
                            <span key={index} className={getPricingBadgeClass(p)}>
                              {getPricingBadge(p)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-700 text-sm mb-4 line-clamp-2">{service.summary}</p>

                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(service.features) ? service.features : []).slice(0, 3).map((feature, index) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded text-xs"
                      >
                        {feature}
                      </span>
                    ))}
                    {(Array.isArray(service.features) ? service.features : []).length > 3 && (
                      <span className="inline-block px-2 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded text-xs">
                        +{(Array.isArray(service.features) ? service.features : []).length - 3}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredServices.map((service) => (
                <Link
                  key={service.id}
                  href={service.url ? `/ai-tool/${(() => { try { const u=new URL(service.url.startsWith('http')?service.url:`https://${service.url}`); return u.hostname.replace(/^www\./,''); } catch { return service.id; } })()}` : `/ai-tool/${service.id}`}
                  aria-label={`${service.name} 상세 보기`}
                  className="block bg-white rounded-lg p-6 border border-gray-300 ring-1 ring-gray-200 shadow-md hover:shadow-lg hover:ring-blue-200 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-500 hover:-translate-y-0.5 transform"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <Logo url={service.url} icon={service.icon} alt={`${service.name} 로고`} size={48} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-xl">{service.name}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-400 fill-current" />
                            <span className="text-sm text-gray-600 ml-1">{service.rating}</span>
                          </div>
                          {service.userCount && (
                            <div className="flex items-center text-sm text-gray-500">
                              <Users className="w-4 h-4 mr-1" />
                              {formatUserCount(service.userCount)}
                            </div>
                          )}
                        </div>
                        {/* 카테고리/가격 배지 */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className={getPricingBadgeClass('other')}>
                            {getCategoryLabel(service.category)}
                          </span>
                          {(Array.isArray(service.pricing) ? service.pricing : [service.pricing].filter(Boolean)).map((p, index) => (
                            <span key={index} className={getPricingBadgeClass(p)}>
                              {getPricingBadge(p)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 mb-4">{service.summary}</p>

                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(service.features) ? service.features : []).map((feature, index) => (
                      <span
                        key={index}
                        className="inline-block px-3 py-1 bg-gray-50 border border-gray-200 text-gray-700 rounded-full text-sm"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* 결과가 없을 때 */}
          {filteredServices.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Search className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">검색 결과가 없습니다</h3>
              <p className="text-gray-600">다른 검색어나 필터를 시도해보세요.</p>
            </div>
          )}

          {/* 페이지네이션 컨트롤 (기존 방식 유지) */}
          {totalCount > 0 && totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-8">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                맨 앞으로
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>
              
              <div className="flex space-x-1">
                {getPageNumbers().map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 text-sm font-medium rounded-md ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                맨뒤로
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 