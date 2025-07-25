"use client";
import { useState, useEffect } from "react";
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  Star, ExternalLink, Filter, Grid, List as ListIcon, Heart, Share2, Download,
  MessageSquare, Code, Image as ImageIcon, FileText, Video, Palette, Database, Brain
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const sideMenus = [
  { name: '홈', icon: <HomeIcon className="w-5 h-5 mr-2" />, href: '/' },
  { name: '검색', icon: <Search className="w-5 h-5 mr-2" />, href: '#' },
  { name: 'AI 목록', icon: <List className="w-5 h-5 mr-2" />, href: '/ai-list' },
  { name: '순위', icon: <BarChart className="w-5 h-5 mr-2" />, href: '#' },
  { name: '광고', icon: <Megaphone className="w-5 h-5 mr-2" />, href: '#' },
  { name: 'AI 뉴스', icon: <Newspaper className="w-5 h-5 mr-2" />, href: '#' },
  { name: '문의하기', icon: <MessageCircle className="w-5 h-5 mr-2" />, href: '#' },
  { name: '설정', icon: <Settings className="w-5 h-5 mr-2" />, href: '#' },
];

const categories = [
  { id: 'all', name: '전체', icon: <Grid className="w-4 h-4" />, count: 0 },
  { id: '챗봇', name: '챗봇', icon: <MessageSquare className="w-4 h-4" />, count: 0 },
  { id: '이미지 생성', name: '이미지 생성', icon: <ImageIcon className="w-4 h-4" />, count: 0 },
  { id: '개발', name: '개발', icon: <Code className="w-4 h-4" />, count: 0 },
  { id: '생산성', name: '생산성', icon: <FileText className="w-4 h-4" />, count: 0 },
  { id: '글쓰기', name: '글쓰기', icon: <FileText className="w-4 h-4" />, count: 0 },
  { id: '디자인', name: '디자인', icon: <Palette className="w-4 h-4" />, count: 0 },
  { id: 'AI 플랫폼', name: 'AI 플랫폼', icon: <Brain className="w-4 h-4" />, count: 0 },
  { id: '비디오', name: '비디오', icon: <Video className="w-4 h-4" />, count: 0 },
  { id: '검색', name: '검색', icon: <Search className="w-4 h-4" />, count: 0 },
  { id: 'AI 프레임워크', name: 'AI 프레임워크', icon: <Code className="w-4 h-4" />, count: 0 },
  { id: 'AI 데이터베이스', name: 'AI 데이터베이스', icon: <Database className="w-4 h-4" />, count: 0 },
  { id: 'ML 도구', name: 'ML 도구', icon: <Brain className="w-4 h-4" />, count: 0 },
  { id: 'ML 플랫폼', name: 'ML 플랫폼', icon: <Brain className="w-4 h-4" />, count: 0 },
  { id: 'AI 인프라', name: 'AI 인프라', icon: <Code className="w-4 h-4" />, count: 0 },
  { id: 'AI 데이터', name: 'AI 데이터', icon: <Database className="w-4 h-4" />, count: 0 },
  { id: '음성', name: '음성', icon: <MessageSquare className="w-4 h-4" />, count: 0 },
];

const pricingOptions = [
  { id: 'all', name: '전체' },
  { id: 'Free', name: '무료' },
  { id: 'Freemium', name: '프리미엄' },
  { id: 'Paid', name: '유료' },
  { id: 'Pay-per-use', name: '사용량 기반' },
];

const sortOptions = [
  { id: 'rating', name: '평점순', icon: <Star className="w-4 h-4" /> },
  { id: 'name', name: '가나다순', icon: <List className="w-4 h-4" /> },
  { id: 'category', name: '카테고리순', icon: <Grid className="w-4 h-4" /> },
  { id: 'pricing', name: '가격순', icon: <BarChart className="w-4 h-4" /> },
  { id: 'newest', name: '최신순', icon: <MessageSquare className="w-4 h-4" /> },
  { id: 'popular', name: '인기순', icon: <Heart className="w-4 h-4" /> },
];

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

export default function AIList() {
  const [services, setServices] = useState<AIService[]>([]);
  const [filteredServices, setFilteredServices] = useState<AIService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPricing, setSelectedPricing] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'rating' | 'name' | 'category' | 'pricing' | 'newest' | 'popular'>('rating');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(16);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showTagList, setShowTagList] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<{tag: string, count: number}[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagPage, setTagPage] = useState(1);
  const [tagsPerPage] = useState(20);
  const router = useRouter();

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    filterServices();
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
  }, [services, searchQuery, selectedCategory, selectedPricing, sortBy, selectedTags]);

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/ai-services');
      const data = await response.json();
      setServices(data.services);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    // 태그 기반 검색
    if (selectedTags.length > 0) {
      filtered = filtered.filter(service =>
        selectedTags.every(tag => 
          service.features && service.features.some(feature => 
            feature && feature.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    // 일반 검색 필터
    if (searchQuery && !searchQuery.startsWith('#')) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.features && service.features.some(feature => 
          feature && feature.toLowerCase().includes(searchQuery.toLowerCase())
        ))
      );
    }

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    // 가격 필터
    if (selectedPricing !== 'all') {
      filtered = filtered.filter(service => service.pricing === selectedPricing);
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          return a.category.localeCompare(b.category);
        case 'pricing':
          return a.pricing.localeCompare(b.pricing);
        case 'newest':
          return b.id - a.id; // ID가 높을수록 최신
        case 'popular':
          // 사용자 수 기반 인기도 계산
          const aUserCount = a.userCount || 0;
          const bUserCount = b.userCount || 0;
          return bUserCount - aUserCount;
        default:
          return b.rating - a.rating;
      }
    });

    setFilteredServices(filtered);
  };

              // 페이지네이션 계산
              const totalPages = Math.ceil(filteredServices.length / itemsPerPage);
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const currentServices = filteredServices.slice(startIndex, endIndex);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '챗봇':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case '이미지 생성':
        return <ImageIcon className="w-5 h-5 text-purple-500" />;
      case '개발':
        return <Code className="w-5 h-5 text-green-500" />;
      case '생산성':
        return <FileText className="w-5 h-5 text-orange-500" />;
      case '글쓰기':
        return <FileText className="w-5 h-5 text-indigo-500" />;
      case '디자인':
        return <Palette className="w-5 h-5 text-pink-500" />;
      case 'AI 플랫폼':
        return <Brain className="w-5 h-5 text-red-500" />;
      case '비디오':
        return <Video className="w-5 h-5 text-yellow-500" />;
      case '검색':
        return <Search className="w-5 h-5 text-teal-500" />;
      case 'AI 프레임워크':
        return <Code className="w-5 h-5 text-cyan-500" />;
      case 'AI 데이터베이스':
        return <Database className="w-5 h-5 text-gray-500" />;
      case 'ML 도구':
        return <Brain className="w-5 h-5 text-violet-500" />;
      case 'ML 플랫폼':
        return <Brain className="w-5 h-5 text-emerald-500" />;
      case 'AI 인프라':
        return <Code className="w-5 h-5 text-slate-500" />;
      case 'AI 데이터':
        return <Database className="w-5 h-5 text-amber-500" />;
      case '음성':
        return <MessageSquare className="w-5 h-5 text-rose-500" />;
      case '음악':
        return <span className="text-2xl">🎵</span>;
      default:
        return <Grid className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPricingBadge = (pricing: string) => {
    switch (pricing) {
      case 'Free':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">무료</span>;
      case 'Freemium':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">프리미엄</span>;
      case 'Paid':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">유료</span>;
      case 'Pay-per-use':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">사용량 기반</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">알 수 없음</span>;
    }
  };

  const handleServiceClick = (service: AIService) => {
    router.push(`/ai-tool/${service.id}`);
  };

  const formatUserCount = (userCount?: number) => {
    if (!userCount) return null;
    
    if (userCount >= 1000000) {
      return `${(userCount / 1000000).toFixed(1)}M`;
    } else if (userCount >= 1000) {
      return `${(userCount / 1000).toFixed(1)}K`;
    } else {
      return userCount.toString();
    }
  };

  // 모든 태그 수집
  const getAllTags = () => {
    const tags = new Set<string>();
    const normalizedTags = new Map<string, string>(); // 정규화된 태그를 원본 태그로 매핑
    
    // 의미 없는 태그들 정의
    const meaninglessTags = [
      '알 수 없음', '알수없음', 'unknown', 'none', 'n/a', 'na',
      '기타', 'etc', 'etc.', '기타등등', '기타 등등',
      '무제', '제목없음', 'untitled', 'no title',
      '설명없음', 'no description', 'no desc',
      '태그없음', 'no tag', 'no tags',
      '기본', 'default', '일반', 'general',
      '임시', 'temp', 'temporary', 'test',
      '샘플', 'sample', '예시', 'example',
      '더미', 'dummy', 'fake', '가짜',
      '빈', 'empty', 'null', 'undefined'
    ];
    
    services.forEach(service => {
      if (service.features) {
        service.features.forEach(feature => {
          if (feature && feature.trim()) {
            const trimmedFeature = feature.trim();
            
            // 기본 필터링 조건
            if (trimmedFeature.length < 2) return;
            if (/^\d+$/.test(trimmedFeature)) return;
            
            // 의미 없는 태그 제거
            const featureLower = trimmedFeature.toLowerCase();
            if (meaninglessTags.some(meaningless => featureLower.includes(meaningless))) {
              return;
            }
            
            // 태그 정규화 (공백 제거, 소문자 변환)
            const normalized = trimmedFeature.toLowerCase().replace(/\s+/g, '');
            
            // 중복 태그 처리
            if (!normalizedTags.has(normalized)) {
              normalizedTags.set(normalized, trimmedFeature);
              tags.add(trimmedFeature);
            }
          }
        });
      }
    });
    
    // 유사한 태그들을 통합
    const tagList = Array.from(tags);
    const mergedTags = new Set<string>();
    
    tagList.forEach(tag => {
      const normalized = tag.toLowerCase().replace(/\s+/g, '');
      let isDuplicate = false;
      
      // 이미 추가된 태그들과 비교
      for (const existingTag of mergedTags) {
        const existingNormalized = existingTag.toLowerCase().replace(/\s+/g, '');
        
        // 완전히 동일하거나 매우 유사한 태그들 통합
        if (normalized === existingNormalized || 
            (normalized.includes(existingNormalized) && normalized.length - existingNormalized.length <= 2) ||
            (existingNormalized.includes(normalized) && existingNormalized.length - normalized.length <= 2)) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        mergedTags.add(tag);
      }
    });
    
    return Array.from(mergedTags).sort();
  };

  // 태그 제안 생성
  const generateTagSuggestions = (query: string) => {
    if (!query.startsWith('#')) return [];
    const tagQuery = query.slice(1).toLowerCase();
    const allTags = getAllTags();
    
    // 의미 있는 태그만 필터링
    const meaningfulTags = allTags.filter(tag => {
      const trimmedTag = tag.trim();
      
      // 기본 필터링 조건
      if (trimmedTag.length < 2) return false;
      if (/^\d+$/.test(trimmedTag)) return false;
      if (/^\d+개 도구$/.test(trimmedTag)) return false;
      if (/^\d+개$/.test(trimmedTag)) return false;
      
      // 의미 없는 태그들 제거
      const meaninglessTags = [
        '알 수 없음', '알수없음', 'unknown', 'none', 'n/a', 'na',
        '기타', 'etc', 'etc.', '기타등등', '기타 등등',
        '무제', '제목없음', 'untitled', 'no title',
        '설명없음', 'no description', 'no desc',
        '태그없음', 'no tag', 'no tags',
        '기본', 'default', '일반', 'general',
        '임시', 'temp', 'temporary', 'test',
        '샘플', 'sample', '예시', 'example',
        '더미', 'dummy', 'fake', '가짜',
        '빈', 'empty', 'null', 'undefined'
      ];
      
      const tagLower = trimmedTag.toLowerCase();
      if (meaninglessTags.some(meaningless => tagLower.includes(meaningless))) {
        return false;
      }
      
      return true;
    });
    
    const filteredTags = meaningfulTags.filter(tag => 
      tag.toLowerCase().includes(tagQuery)
    );
    
    // 각 태그별 도구 개수 계산
    const tagsWithCount = filteredTags.map(tag => {
      const count = services.filter(service =>
        service.features && service.features.some(feature => 
          feature && feature.toLowerCase().includes(tag.toLowerCase())
        )
      ).length;
      return { tag, count };
    });
    
    // 중복 제거 및 통합
    const uniqueTags = new Map<string, {tag: string, count: number}>();
    
    tagsWithCount.forEach(item => {
      const normalized = item.tag.toLowerCase().replace(/\s+/g, '');
      let isDuplicate = false;
      
      // 기존 태그들과 비교하여 중복 확인
      for (const [existingNormalized, existingItem] of uniqueTags) {
        if (normalized === existingNormalized || 
            (normalized.includes(existingNormalized) && normalized.length - existingNormalized.length <= 2) ||
            (existingNormalized.includes(normalized) && existingNormalized.length - normalized.length <= 2)) {
          // 더 많은 도구를 가진 태그를 유지
          if (item.count > existingItem.count) {
            uniqueTags.delete(existingNormalized);
            uniqueTags.set(normalized, item);
          }
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueTags.set(normalized, item);
      }
    });
    
    // 도구 수가 많은 순서대로 정렬하고 상위 10개만 반환
    return Array.from(uniqueTags.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  // 검색 입력 처리
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

  // 태그 선택
  const handleTagSelect = (tag: string) => {
    setSelectedTags(prev => [...prev, tag]);
    setSearchQuery('');
    setShowTagSuggestions(false);
  };

  // 태그 제거
  const handleTagRemove = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar currentPath="/ai-list" />
          <div className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
        <Sidebar currentPath="/ai-list" />
        <div className="flex-1 p-8">
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
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedTags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                  >
                    #{tag}
                    <button
                      onClick={() => handleTagRemove(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* 태그 목록 (버튼 클릭 시 표시) */}
            {showTagList && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-sm font-medium text-gray-700 mb-3">
                  태그 목록 (페이지 {tagPage})
                </div>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    // 태그별 도구 개수 계산 및 정렬
                    const allTagsWithCount = getAllTags().map(tag => {
                      const count = services.filter(service =>
                        service.features && service.features.some(feature => 
                          feature && feature.toLowerCase().includes(tag.toLowerCase())
                        )
                      ).length;
                      return { tag, count };
                    }).sort((a, b) => b.count - a.count);

                    // 페이지네이션 계산
                    const startIndex = (tagPage - 1) * tagsPerPage;
                    const endIndex = startIndex + tagsPerPage;
                    const tagsWithCount = allTagsWithCount.slice(startIndex, endIndex);
                    const totalPages = Math.ceil(allTagsWithCount.length / tagsPerPage);

                    // 도구 개수 표시 함수
                    const getCountDisplay = (count: number) => {
                      return `${count}개`;
                    };

                    // 태그 색상 함수
                    const getTagColor = (tag: string) => {
                      const tagLower = tag.toLowerCase();
                      if (tagLower.includes('ai') || tagLower.includes('생성') || tagLower.includes('자동화')) return 'blue';
                      if (tagLower.includes('이미지') || tagLower.includes('디자인') || tagLower.includes('3d') || tagLower.includes('렌더링')) return 'purple';
                      if (tagLower.includes('음악') || tagLower.includes('음성') || tagLower.includes('오디오')) return 'pink';
                      if (tagLower.includes('비디오') || tagLower.includes('영상') || tagLower.includes('동영상')) return 'yellow';
                      if (tagLower.includes('챗봇') || tagLower.includes('대화') || tagLower.includes('통신')) return 'green';
                      if (tagLower.includes('개발') || tagLower.includes('코드') || tagLower.includes('프로그래밍')) return 'indigo';
                      if (tagLower.includes('분석') || tagLower.includes('데이터') || tagLower.includes('통계')) return 'teal';
                      if (tagLower.includes('교육') || tagLower.includes('학습') || tagLower.includes('훈련')) return 'orange';
                      if (tagLower.includes('협업') || tagLower.includes('팀') || tagLower.includes('공유')) return 'emerald';
                      if (tagLower.includes('검색') || tagLower.includes('찾기') || tagLower.includes('탐색')) return 'cyan';
                      if (tagLower.includes('보안') || tagLower.includes('암호화') || tagLower.includes('보호')) return 'red';
                      if (tagLower.includes('마케팅') || tagLower.includes('광고') || tagLower.includes('홍보')) return 'rose';
                      if (tagLower.includes('고객') || tagLower.includes('서비스') || tagLower.includes('지원')) return 'violet';
                      if (tagLower.includes('모바일') || tagLower.includes('앱') || tagLower.includes('스마트폰')) return 'lime';
                      if (tagLower.includes('웹') || tagLower.includes('사이트') || tagLower.includes('온라인')) return 'sky';
                      if (tagLower.includes('플랫폼') || tagLower.includes('시스템') || tagLower.includes('인프라')) return 'slate';
                      if (tagLower.includes('고품질') || tagLower.includes('프리미엄') || tagLower.includes('전문')) return 'amber';
                      if (tagLower.includes('무료') || tagLower.includes('공개') || tagLower.includes('오픈')) return 'green';
                      if (tagLower.includes('실시간') || tagLower.includes('즉시') || tagLower.includes('빠른')) return 'blue';
                      if (tagLower.includes('통합') || tagLower.includes('연결') || tagLower.includes('연동')) return 'indigo';
                      if (tagLower.includes('모델링') || tagLower.includes('모델') || tagLower.includes('구조')) return 'purple';
                      if (tagLower.includes('캡처') || tagLower.includes('스캔') || tagLower.includes('인식')) return 'cyan';
                      if (tagLower.includes('테스트') || tagLower.includes('검증') || tagLower.includes('확인')) return 'orange';
                      if (tagLower.includes('agi') || tagLower.includes('감지') || tagLower.includes('개선')) return 'blue';
                      if (tagLower.includes('게임') || tagLower.includes('엔터테인먼트') || tagLower.includes('놀이')) return 'lime';
                      if (tagLower.includes('관찰') || tagLower.includes('모니터링') || tagLower.includes('추적')) return 'teal';
                      if (tagLower.includes('도구') || tagLower.includes('유틸리티') || tagLower.includes('기능')) return 'slate';
                      if (tagLower.includes('생산성') || tagLower.includes('효율') || tagLower.includes('최적화')) return 'emerald';
                      if (tagLower.includes('창작') || tagLower.includes('작성') || tagLower.includes('글쓰기')) return 'violet';
                      if (tagLower.includes('번역') || tagLower.includes('언어') || tagLower.includes('다국어')) return 'sky';
                      if (tagLower.includes('요약') || tagLower.includes('정리') || tagLower.includes('간소화')) return 'amber';
                      if (tagLower.includes('예측') || tagLower.includes('예상') || tagLower.includes('미래')) return 'indigo';
                      if (tagLower.includes('추천') || tagLower.includes('제안') || tagLower.includes('추천')) return 'rose';
                      if (tagLower.includes('최적화') || tagLower.includes('성능') || tagLower.includes('속도')) return 'green';
                      if (tagLower.includes('스케줄링') || tagLower.includes('일정') || tagLower.includes('시간')) return 'orange';
                      if (tagLower.includes('리뷰') || tagLower.includes('평가') || tagLower.includes('점수')) return 'yellow';
                      if (tagLower.includes('보고서') || tagLower.includes('문서') || tagLower.includes('파일')) return 'slate';
                      if (tagLower.includes('대화형') || tagLower.includes('인터랙티브') || tagLower.includes('상호작용')) return 'pink';
                      if (tagLower.includes('클라우드') || tagLower.includes('호스팅') || tagLower.includes('배포')) return 'sky';
                      if (tagLower.includes('api') || tagLower.includes('연동') || tagLower.includes('통합')) return 'indigo';
                      if (tagLower.includes('머신러닝') || tagLower.includes('딥러닝') || tagLower.includes('신경망')) return 'blue';
                      if (tagLower.includes('자연어') || tagLower.includes('nlp') || tagLower.includes('텍스트')) return 'violet';
                      if (tagLower.includes('컴퓨터비전') || tagLower.includes('이미지인식') || tagLower.includes('객체감지')) return 'purple';
                      if (tagLower.includes('음성인식') || tagLower.includes('stt') || tagLower.includes('말하기')) return 'pink';
                      if (tagLower.includes('음성합성') || tagLower.includes('tts') || tagLower.includes('읽기')) return 'pink';
                      if (tagLower.includes('감정분석') || tagLower.includes('감정') || tagLower.includes('기분')) return 'rose';
                      if (tagLower.includes('추천시스템') || tagLower.includes('개인화') || tagLower.includes('맞춤')) return 'violet';
                      if (tagLower.includes('예측분석') || tagLower.includes('예측') || tagLower.includes('미래')) return 'indigo';
                      if (tagLower.includes('데이터마이닝') || tagLower.includes('패턴') || tagLower.includes('발견')) return 'teal';
                      if (tagLower.includes('로봇공학') || tagLower.includes('자동화') || tagLower.includes('기계')) return 'blue';
                      if (tagLower.includes('블록체인') || tagLower.includes('암호화폐') || tagLower.includes('탈중앙화')) return 'emerald';
                      if (tagLower.includes('iot') || tagLower.includes('사물인터넷') || tagLower.includes('센서')) return 'lime';
                      if (tagLower.includes('ar') || tagLower.includes('vr') || tagLower.includes('가상현실')) return 'purple';
                      if (tagLower.includes('드론') || tagLower.includes('로봇') || tagLower.includes('자동화')) return 'blue';
                      if (tagLower.includes('의료') || tagLower.includes('헬스케어') || tagLower.includes('진단')) return 'red';
                      if (tagLower.includes('금융') || tagLower.includes('은행') || tagLower.includes('투자')) return 'green';
                      if (tagLower.includes('법률') || tagLower.includes('계약') || tagLower.includes('규정')) return 'slate';
                      if (tagLower.includes('미디어') || tagLower.includes('콘텐츠') || tagLower.includes('출판')) return 'yellow';
                      if (tagLower.includes('여행') || tagLower.includes('관광') || tagLower.includes('호텔')) return 'cyan';
                      if (tagLower.includes('운송') || tagLower.includes('물류') || tagLower.includes('배송')) return 'orange';
                      if (tagLower.includes('에너지') || tagLower.includes('환경') || tagLower.includes('지속가능')) return 'emerald';
                      if (tagLower.includes('농업') || tagLower.includes('식품') || tagLower.includes('농업')) return 'lime';
                      if (tagLower.includes('건설') || tagLower.includes('건축') || tagLower.includes('엔지니어링')) return 'amber';
                      if (tagLower.includes('군사') || tagLower.includes('방위') || tagLower.includes('보안')) return 'red';
                      if (tagLower.includes('스포츠') || tagLower.includes('운동') || tagLower.includes('피트니스')) return 'green';
                      if (tagLower.includes('패션') || tagLower.includes('스타일') || tagLower.includes('의류')) return 'rose';
                      if (tagLower.includes('뷰티') || tagLower.includes('화장품') || tagLower.includes('미용')) return 'pink';
                      if (tagLower.includes('부동산') || tagLower.includes('집') || tagLower.includes('매물')) return 'amber';
                      if (tagLower.includes('교육') || tagLower.includes('학습') || tagLower.includes('훈련')) return 'orange';
                      if (tagLower.includes('연구') || tagLower.includes('과학') || tagLower.includes('실험')) return 'indigo';
                      if (tagLower.includes('정부') || tagLower.includes('공공') || tagLower.includes('행정')) return 'slate';
                      if (tagLower.includes('비영리') || tagLower.includes('자선') || tagLower.includes('사회')) return 'emerald';
                      if (tagLower.includes('엔터테인먼트') || tagLower.includes('게임') || tagLower.includes('놀이')) return 'lime';
                      if (tagLower.includes('음식') || tagLower.includes('레스토랑') || tagLower.includes('요리')) return 'orange';
                      if (tagLower.includes('음료') || tagLower.includes('카페') || tagLower.includes('커피')) return 'amber';
                      if (tagLower.includes('주류') || tagLower.includes('술') || tagLower.includes('와인')) return 'red';
                      if (tagLower.includes('담배') || tagLower.includes('니코틴') || tagLower.includes('흡연')) return 'slate';
                      if (tagLower.includes('의약품') || tagLower.includes('약') || tagLower.includes('치료')) return 'red';
                      if (tagLower.includes('화장품') || tagLower.includes('스킨케어') || tagLower.includes('미용')) return 'pink';
                      if (tagLower.includes('의류') || tagLower.includes('패션') || tagLower.includes('옷')) return 'rose';
                      if (tagLower.includes('신발') || tagLower.includes('구두') || tagLower.includes('운동화')) return 'amber';
                      if (tagLower.includes('가방') || tagLower.includes('백팩') || tagLower.includes('핸드백')) return 'violet';
                      if (tagLower.includes('액세서리') || tagLower.includes('장신구') || tagLower.includes('주얼리')) return 'rose';
                      if (tagLower.includes('스포츠용품') || tagLower.includes('운동기구') || tagLower.includes('피트니스')) return 'green';
                      if (tagLower.includes('아이템') || tagLower.includes('상품') || tagLower.includes('제품')) return 'slate';
                      return 'gray';
                    };

                    const colorClasses = {
                      blue: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
                      purple: 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100',
                      pink: 'bg-pink-50 border-pink-200 text-pink-700 hover:bg-pink-100',
                      yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100',
                      green: 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100',
                      indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100',
                      teal: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100',
                      orange: 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100',
                      emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                      cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100',
                      red: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
                      rose: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
                      violet: 'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
                      lime: 'bg-lime-50 border-lime-200 text-lime-700 hover:bg-lime-100',
                      sky: 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100',
                      slate: 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100',
                      amber: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
                      gray: 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    };

                    return (
                      <>
                        {tagsWithCount.map((item, index) => {
                          const color = getTagColor(item.tag);
                          return (
                            <button
                              key={index}
                              onClick={() => {
                                handleTagSelect(item.tag);
                                setShowTagList(false);
                                setTagPage(1);
                              }}
                              className={`inline-flex items-center gap-1 px-3 py-1 text-sm border rounded-full transition-colors ${colorClasses[color]}`}
                            >
                              #{item.tag} ({getCountDisplay(item.count)})
                            </button>
                          );
                        })}
                        
                        {/* 페이지네이션 버튼들 */}
                        <div className="w-full flex justify-center gap-2 mt-4">
                          <button
                            onClick={() => setTagPage(prev => Math.max(1, prev - 1))}
                            disabled={tagPage === 1}
                            className={`px-3 py-1 text-sm border rounded-lg transition-colors ${
                              tagPage === 1 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                            }`}
                          >
                            이전 태그
                          </button>
                          
                          <span className="px-3 py-1 text-sm text-gray-600">
                            {tagPage} / {totalPages}
                          </span>
                          
                          <button
                            onClick={() => setTagPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={tagPage === totalPages}
                            className={`px-3 py-1 text-sm border rounded-lg transition-colors ${
                              tagPage === totalPages 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                            }`}
                          >
                            다음 태그
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

                                {/* 결과 카운트 */}
                      <div className="mb-4">
                        <p className="text-gray-800 font-semibold">
                          {filteredServices.length}개의 AI 도구를 찾았습니다
                        </p>
                      </div>

                                {/* AI 도구 목록 */}
                      {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {currentServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleServiceClick(service)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {service.icon ? (
                          <img 
                            src={service.icon} 
                            alt={`${service.name} icon`}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`${service.icon ? 'hidden' : ''}`}>
                          {getCategoryIcon(service.category)}
                        </div>
                        <span className="text-sm text-gray-800 font-semibold">{service.category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-bold text-gray-900">{service.rating}</span>
                        </div>
                        {service.userCount && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">👥</span>
                            <span className="text-xs font-medium text-gray-600">{formatUserCount(service.userCount)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{service.name}</h3>
                    <p className="text-gray-800 text-sm mb-4 line-clamp-3 font-semibold">{service.description}</p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {service.features.slice(0, 3).map((feature, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-800 font-medium rounded-full"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      {getPricingBadge(service.pricing)}
                      <ExternalLink className="w-4 h-4 text-gray-600" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
                                ) : (
                        <div className="space-y-4">
                          {currentServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleServiceClick(service)}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {service.icon ? (
                            <img 
                              src={service.icon} 
                              alt={`${service.name} icon`}
                              className="w-6 h-6 object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`${service.icon ? 'hidden' : ''}`}>
                            {getCategoryIcon(service.category)}
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-400 fill-current" />
                              <span className="text-sm font-bold text-gray-900">{service.rating}</span>
                            </div>
                            {service.userCount && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">👥</span>
                                <span className="text-xs font-medium text-gray-600">{formatUserCount(service.userCount)}</span>
                              </div>
                            )}
                          </div>
                          {getPricingBadge(service.pricing)}
                        </div>
                        <p className="text-gray-800 mb-3 font-semibold">{service.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {service.features.map((feature, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-800 font-medium rounded-full"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ExternalLink className="w-5 h-5 text-gray-600 ml-4" />
                    </div>
                  </div>
                </div>
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
                          <p className="text-gray-800 font-semibold">다른 검색어나 필터를 시도해보세요</p>
                        </div>
                      )}

                      {/* 페이지네이션 */}
                      {filteredServices.length > 0 && totalPages > 1 && (
                        <div className="mt-8 flex items-center justify-center">
                          <div className="flex items-center space-x-2">
                            {/* 이전 페이지 */}
                            <button
                              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                              disabled={currentPage === 1}
                              className={`px-3 py-2 rounded-lg border ${
                                currentPage === 1
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                              }`}
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
                                  onClick={() => setCurrentPage(pageNum)}
                                  className={`px-3 py-2 rounded-lg border ${
                                    currentPage === pageNum
                                      ? 'bg-blue-500 text-white border-blue-500'
                                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}

                            {/* 다음 페이지 */}
                            <button
                              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                              disabled={currentPage === totalPages}
                              className={`px-3 py-2 rounded-lg border ${
                                currentPage === totalPages
                                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
                              }`}
                            >
                              다음
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 페이지 정보 */}
                      {filteredServices.length > 0 && (
                        <div className="mt-4 text-center text-sm text-gray-800 font-semibold">
                          {startIndex + 1}-{Math.min(endIndex, filteredServices.length)} / {filteredServices.length}개 도구
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            } 