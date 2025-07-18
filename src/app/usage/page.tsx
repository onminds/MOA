"use client";
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Header from '../components/Header';
import { useRouter } from 'next/navigation';
import { 
  ImageIcon, 
  Video,
  Clock,
  Crown,
  Star,
  Zap,
  TrendingUp
} from 'lucide-react';

interface UsageInfo {
  allowed: boolean;
  usageCount: number;
  limitCount: number;
  remainingCount: number;
  planType?: string;
  resetDate: string;
}

export default function UsagePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [usageData, setUsageData] = useState<{
    'image-generate': UsageInfo | null;
    'video-generate': UsageInfo | null;
  }>({
    'image-generate': null,
    'video-generate': null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (mounted && session) {
      fetchUsageData();
    }
  }, [mounted, session, status, router]);

  const fetchUsageData = async () => {
    setLoading(true);
    const services = ['image-generate', 'video-generate'];
    
    try {
      const promises = services.map(async (service) => {
        const response = await fetch(`/api/usage/check?serviceType=${service}`);
        if (response.ok) {
          const data = await response.json();
          return { service, data };
        }
        return { service, data: null };
      });

      const results = await Promise.all(promises);
      const newUsageData = { ...usageData };
      
      results.forEach(({ service, data }) => {
        newUsageData[service as keyof typeof usageData] = data;
      });
      
      setUsageData(newUsageData);
    } catch (error) {
      console.error('사용량 데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceInfo = (serviceType: string) => {
    switch (serviceType) {
      case 'image-generate':
        return {
          name: '이미지 생성',
          icon: <ImageIcon className="w-6 h-6" />,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      case 'video-generate':
        return {
          name: '영상 생성',
          icon: <Video className="w-6 h-6" />,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      default:
        return {
          name: '알 수 없음',
          icon: <Star className="w-6 h-6" />,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'basic':
        return <Zap className="w-5 h-5 text-gray-500" />;
      case 'standard':
        return <Star className="w-5 h-5 text-blue-500" />;
      case 'pro':
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 'admin':
        return <Crown className="w-5 h-5 text-purple-500" />;
      default:
        return <Zap className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPlanName = (planType: string) => {
    switch (planType) {
      case 'basic':
        return '기본 플랜';
      case 'standard':
        return 'Standard 플랜';
      case 'pro':
        return 'Pro 플랜';
      case 'admin':
        return '관리자 플랜';
      default:
        return '기본 플랜';
    }
  };

  if (!mounted) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex bg-white">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">로딩 중...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (status === 'loading') {
    return (
      <>
        <Header />
        <div className="min-h-screen flex bg-white">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">로딩 중...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">사용량 확인</h1>
            <p className="text-gray-600">현재 플랜의 서비스별 사용량을 확인하세요</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">사용량 정보를 불러오는 중...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(usageData).map(([serviceType, usage]) => {
                if (!usage) return null;
                
                const serviceInfo = getServiceInfo(serviceType);
                const percentage = (usage.usageCount / usage.limitCount) * 100;
                
                return (
                  <div
                    key={serviceType}
                    className={`bg-white rounded-xl shadow-lg border-2 ${serviceInfo.borderColor} p-6 hover:shadow-xl transition-shadow`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-3 rounded-xl ${serviceInfo.bgColor}`}>
                          <div className={serviceInfo.color}>
                            {serviceInfo.icon}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {serviceInfo.name}
                          </h3>
                          {usage.planType && (
                            <div className="flex items-center space-x-1 mt-1">
                              {getPlanIcon(usage.planType)}
                              <span className="text-sm text-gray-600">
                                {getPlanName(usage.planType)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {usage.remainingCount === 9999 ? "무제한" : usage.remainingCount}
                        </div>
                        <div className="text-sm text-gray-500">남은 횟수</div>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>사용량</span>
                        <span>{usage.usageCount} / {usage.limitCount === 9999 ? "무제한" : usage.limitCount}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            percentage >= 80 ? 'bg-red-500' : 
                            percentage >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <span className="flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {percentage.toFixed(1)}% 사용
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          플랜별 총 제한
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-12 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              더 많은 기능이 필요하신가요?
            </h3>
            <p className="text-gray-600 mb-4">
              플랜을 업그레이드하여 더 많은 사용량을 얻으세요
            </p>
          </div>
        </div>
      </div>
    </>
  );
} 