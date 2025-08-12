"use client";
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Crown, Check, Star, Zap, Shield } from 'lucide-react';
import Link from 'next/link';
import SubscriptionPaymentButton from '../components/SubscriptionPaymentButton';

interface PlanInfo {
  planType: string;
  planInfo: {
    name: string;
    displayName: string;
    color: string;
    features: string[];
  };
}

export default function PlanPage() {
  const { data: session } = useSession();
  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [userPlanInfo, setUserPlanInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const fetchUserPlan = async () => {
    if (session?.user?.id) {
      try {
        const response = await fetch('/api/user/plan');
        if (response.ok) {
          const data = await response.json();
          setUserPlanInfo(data);
        }
      } catch (error) {
        console.error('플랜 정보 조회 오류:', error);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUserPlan();
  }, [session?.user?.id]);

  const plans = [
    {
      id: 'basic',
      name: 'Basic Plan',
      price: '0원',
      period: '무료',
      description: '기본 기능을 무료로 이용',
      features: [
        '월 2회 이미지 생성',
        '월 1회 영상 생성',
        '기본 AI 도구 사용',
        '커뮤니티 읽기',
        '이메일 지원'
      ],
      color: 'from-blue-400 to-blue-600',
      popular: false
    },
    {
      id: 'standard',
      name: 'Standard Plan',
      price: '15,900원',
      period: '월',
      description: '개인 사용자를 위한 표준 플랜',
      features: [
        '월 120회 이미지 생성',
        '월 20회 영상 생성',
        '모든 AI 도구 사용',
        '우선 고객 지원',
        '고급 분석 기능',
        '커뮤니티 글쓰기',
        '광고 제거'
      ],
      color: 'from-yellow-400 to-orange-500',
      popular: true
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      price: '29,000원',
      period: '월',
      description: '팀과 기업을 위한 고급 기능',
      features: [
        '월 300회 이미지 생성',
        '월 45회 영상 생성',
        '모든 AI 도구 사용',
        'API 접근',
        '전용 고객 지원',
        '팀 관리 기능',
        '고급 분석 대시보드',
        '맞춤형 통합'
      ],
      color: 'from-purple-400 to-pink-500',
      popular: false
    }
  ];

  const getCurrentPlan = () => {
    if (!userPlanInfo) return 'basic';
    return userPlanInfo.planType.toLowerCase();
  };

  const currentPlan = getCurrentPlan();

  const getCurrentPlanInfo = () => {
    if (!userPlanInfo) {
      return {
        name: 'Basic Plan',
        displayName: 'Basic',
        color: 'from-blue-400 to-blue-600',
        description: '기본 기능을 무료로 이용하고 계십니다.'
      };
    }
    return {
      name: userPlanInfo.planInfo.name,
      displayName: userPlanInfo.planInfo.displayName,
      color: userPlanInfo.planInfo.color,
      description: userPlanInfo.planType === 'basic' 
        ? '기본 기능을 무료로 이용하고 계십니다.'
        : `${userPlanInfo.planInfo.name}을 이용하고 계십니다.`
    };
  };

  const currentPlanInfo = getCurrentPlanInfo();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">플랜 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full">
              <Crown className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            플랜 선택
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {session?.user?.name || '사용자'}님을 위한 최적의 플랜을 선택하세요
          </p>
        </div>

        {/* 현재 플랜 상태 */}
        <div className="max-w-md mx-auto mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-yellow-400">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">현재 플랜</h3>
              <div className={`flex items-center space-x-2 px-3 py-1 bg-gradient-to-r ${currentPlanInfo.color} rounded-full text-white text-sm font-medium`}>
                <Crown className="w-4 h-4" />
                <span>{currentPlanInfo.displayName} Plan</span>
              </div>
            </div>
            <p className="text-gray-600 mb-4">
              {currentPlanInfo.description}
            </p>
            <div className="text-sm text-gray-500">
              다음 결제일: {userPlanInfo?.planType === 'basic' ? '무료 플랜' : '매월 자동 결제'}
            </div>
          </div>
        </div>

        {/* 결제 메시지 */}
        {paymentMessage && (
          <div className="max-w-md mx-auto mb-8">
            <div className={`rounded-xl p-4 ${
              paymentMessage.type === 'success' 
                ? 'bg-green-100 border border-green-400 text-green-700' 
                : 'bg-red-100 border border-red-400 text-red-700'
            }`}>
              <div className="flex items-center justify-between">
                <span>{paymentMessage.message}</span>
                <button
                  onClick={() => setPaymentMessage(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 플랜 카드들 */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg overflow-visible transition-all duration-300 hover:shadow-xl ${
                plan.popular ? 'ring-2 ring-yellow-400 scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-1 shadow-lg">
                    <Star className="w-4 h-4" />
                    <span>인기</span>
                  </div>
                </div>
              )}

              <div className={`p-8 ${plan.popular ? 'pt-16' : 'pt-8'}`}>
                {/* 플랜 헤더 */}
                <div className="text-center mb-8">
                  <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r ${plan.color} rounded-full mb-4`}>
                    {plan.id === 'basic' && <Crown className="w-8 h-8 text-white" />}
                    {plan.id === 'standard' && <Zap className="w-8 h-8 text-white" />}
                    {plan.id === 'pro' && <Shield className="w-8 h-8 text-white" />}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600">/{plan.period}</span>
                  </div>
                  <p className="text-gray-600">{plan.description}</p>
                </div>

                {/* 기능 목록 */}
                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <Check className="w-5 h-5 text-green-500" />
                      </div>
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* 버튼 */}
                <div className="h-16 flex items-center">
                  {plan.id === currentPlan ? (
                    <button
                      className="w-full py-4 px-6 rounded-xl font-semibold transition-all duration-200 h-14 flex items-center justify-center bg-gray-200 text-gray-500 cursor-not-allowed"
                      disabled
                    >
                      현재 플랜
                    </button>
                  ) : plan.id === 'basic' ? (
                    <button
                      className="w-full py-4 px-6 rounded-xl font-semibold transition-all duration-200 h-14 flex items-center justify-center bg-gray-900 text-white hover:bg-gray-800 transform hover:-translate-y-1"
                      onClick={() => {
                        // Basic 플랜은 무료이므로 즉시 적용
                        setPaymentMessage({ type: 'success', message: 'Basic 플랜이 적용되었습니다!' });
                      }}
                    >
                      무료로 시작
                    </button>
                  ) : (
                    <div className="w-full">
                      {plan.id === 'standard' ? (
                        <SubscriptionPaymentButton
                          planId="standard"
                          planName="Standard Plan"
                          amount={15900}
                          onSuccess={() => {
                            setPaymentMessage({ type: 'success', message: 'Standard 플랜 구독이 설정되었습니다!' });
                            // 플랜 정보 다시 조회 (더 긴 지연 시간)
                            setTimeout(() => {
                              console.log('플랜 정보 재조회 시작...');
                              fetchUserPlan();
                            }, 2000);
                          }}
                          onError={(error: string) => {
                            setPaymentMessage({ type: 'error', message: error });
                          }}
                        />
                      ) : (
                        <SubscriptionPaymentButton
                          planId="pro"
                          planName="Pro Plan"
                          amount={29000}
                          onSuccess={() => {
                            setPaymentMessage({ type: 'success', message: 'Pro 플랜 구독이 설정되었습니다!' });
                            // 플랜 정보 다시 조회 (더 긴 지연 시간)
                            setTimeout(() => {
                              console.log('플랜 정보 재조회 시작...');
                              fetchUserPlan();
                            }, 2000);
                          }}
                          onError={(error: string) => {
                            setPaymentMessage({ type: 'error', message: error });
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ 섹션 */}
        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            자주 묻는 질문
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                언제든지 플랜을 변경할 수 있나요?
              </h3>
              <p className="text-gray-600">
                네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 
                변경사항은 다음 결제일부터 적용됩니다.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                구독 취소는 언제든지 가능한가요?
              </h3>
              <p className="text-gray-600">
                네, 언제든지 구독을 취소할 수 있습니다. 
                취소 후에도 현재 결제 기간이 끝날 때까지 서비스를 이용할 수 있습니다.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                결제는 언제 이루어지나요?
              </h3>
              <p className="text-gray-600">
                매월 구독 시작일(또는 연간 구독의 경우 매년)에 자동으로 결제됩니다. 
                결제 실패 시 3일간 재시도합니다.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                결제 방법은 어떤 것이 있나요?
              </h3>
              <p className="text-gray-600">
                신용카드, 체크카드 등으로 정기 결제가 가능합니다. 
                카드 정보는 안전하게 암호화되어 저장됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 고객 지원 */}
        <div className="text-center mt-16">
          <p className="text-gray-600 mb-4">
            추가 질문이 있으시면 언제든지 문의해 주세요
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center space-x-2 bg-gray-900 text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <span>고객 지원 문의</span>
          </Link>
        </div>
      </div>
    </div>
  );
} 