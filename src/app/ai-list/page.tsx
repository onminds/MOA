"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from '../components/Header';
import { 
  Search, Star, ExternalLink, Filter, Grid, List as ListIcon, Heart, Share2, Download,
  MessageCircle, Users, TrendingUp, Zap, Brain, Palette, Music, Video, FileText, Globe
} from 'lucide-react';

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
  const router = useRouter();
  const [services, setServices] = useState<AIService[]>([]);
  const [filteredServices, setFilteredServices] = useState<AIService[]>([]);
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

  const categories = [
    { id: 'all', name: '전체' },
    { id: 'chat', name: '채팅/대화' },
    { id: 'image', name: '이미지 생성' },
    { id: 'video', name: '영상 생성' },
    { id: 'audio', name: '음성/음악' },
    { id: 'writing', name: '글쓰기' },
    { id: 'coding', name: '코딩' },
    { id: 'productivity', name: '생산성' }
  ];

  const pricingOptions = [
    { id: 'all', name: '전체' },
    { id: 'free', name: '무료' },
    { id: 'freemium', name: '프리미엄' },
    { id: 'paid', name: '유료' }
  ];

  const sortOptions = [
    { id: 'rating', name: '평점순' },
    { id: 'name', name: '이름순' },
    { id: 'users', name: '사용자순' }
  ];

  useEffect(() => {
    fetchServices();
  }, []);

  useEffect(() => {
    filterServices();
  }, [services, searchQuery, selectedCategory, selectedPricing, sortBy, selectedTags]);

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/ai-services');
      const data = await response.json();
      setServices(data.services || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      setLoading(false);
    }
  };

  const filterServices = () => {
    let filtered = [...services];

    // 검색어 필터링
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(service => 
        service.name.toLowerCase().includes(query) ||
        service.description.toLowerCase().includes(query) ||
        service.features.some(feature => feature.toLowerCase().includes(query))
      );
    }

    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(service => service.category === selectedCategory);
    }

    // 가격 필터링
    if (selectedPricing !== 'all') {
      filtered = filtered.filter(service => service.pricing === selectedPricing);
    }

    // 태그 필터링
    if (selectedTags.length > 0) {
      filtered = filtered.filter(service => 
        selectedTags.every(tag => 
          service.features.some(feature => 
            feature.toLowerCase().includes(tag.toLowerCase())
          )
        )
      );
    }

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'users':
          return (b.userCount || 0) - (a.userCount || 0);
        default:
          return 0;
      }
    });

    setFilteredServices(filtered);
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
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">무료</span>;
      case 'freemium':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">프리미엄</span>;
      case 'paid':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">유료</span>;
      default:
        return null;
    }
  };

  const handleServiceClick = (service: AIService) => {
    router.push(`/ai-tool/${service.id}`);
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
    services.forEach(service => {
      service.features.forEach(feature => {
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

  if (loading) {
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="p-8">
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
        <div className="mb-6">
          <p className="text-gray-600">
            총 <span className="font-semibold text-gray-900">{filteredServices.length}</span>개의 AI 도구를 찾았습니다
          </p>
        </div>

        {/* AI 도구 목록 */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                onClick={() => handleServiceClick(service)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      {getCategoryIcon(service.category)}
                    </div>
                    <div>
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
                    </div>
                  </div>
                  {getPricingBadge(service.pricing)}
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description}</p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {service.features.slice(0, 3).map((feature, index) => (
                    <span
                      key={index}
                      className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {feature}
                    </span>
                  ))}
                  {service.features.length > 3 && (
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      +{service.features.length - 3}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{service.source}</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                onClick={() => handleServiceClick(service)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      {getCategoryIcon(service.category)}
                    </div>
                    <div>
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
                        <span className="text-sm text-gray-500">{service.source}</span>
                      </div>
                    </div>
                  </div>
                  {getPricingBadge(service.pricing)}
                </div>

                <p className="text-gray-600 mb-4">{service.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {service.features.map((feature, index) => (
                    <span
                      key={index}
                      className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <Heart className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-green-500 transition-colors">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                  <ExternalLink className="w-5 h-5 text-gray-400" />
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
            <p className="text-gray-600">다른 검색어나 필터를 시도해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
} 