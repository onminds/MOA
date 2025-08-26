"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Crown, Check, Star, Zap, Shield, X } from "lucide-react";
import Link from "next/link";
import PaymentButton from "../components/PaymentButton";
import Header from "../components/Header";

interface PlanInfo {
  planType: string;
  planInfo: {
    name: string;
    displayName: string;
    color: string;
    features: string[];
  };
}

interface SubscriptionInfo {
  subscriptionId: string;
  planType: string;
  status: string; // "active" | "canceled" | ...
  startDate: string;
  nextBillingDate: string;
  autoRenewal: boolean;
  canceledAt: string | null;
  amount: number;
  // 추가 필드(응답에 따라 존재할 수 있음)
  isCancelled?: boolean;
  planChangeDate?: string;
}

export default function PlanPage() {
  const { data: session } = useSession();

  // UI state
  const [userPlanInfo, setUserPlanInfo] = useState<PlanInfo | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMessage, setPaymentMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  // 플랜/구독 정보 조회
  const fetchUserPlan = useCallback(async () => {
    try {
      if (!session?.user?.id) {
        console.log("🔍 세션 사용자 ID 없음");
        setLoading(false);
        return;
      }

      console.log("🔍 fetchUserPlan 시작 - 사용자 ID:", session.user.id);

      // 1) 플랜 정보
      const planResponse = await fetch("/api/user/plan", { method: "GET" });
      console.log("🔍 플랜 정보 API 응답:", { status: planResponse.status, ok: planResponse.ok });

      if (planResponse.ok) {
        const planData = (await planResponse.json()) as PlanInfo;
        console.log("🔍 플랜 정보 데이터:", planData);
        setUserPlanInfo(planData);
      } else {
        console.error("🔍 플랜 정보 API 실패:", planResponse.status);
      }

      // 2) 구독 정보 조회
      const subscriptionResponse = await fetch("/api/payments/cancel-subscription", { method: "GET" });
      console.log("🔍 구독 정보 API 응답:", { status: subscriptionResponse.status, ok: planResponse.ok });

      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        console.log("🔍 구독 정보 데이터:", subscriptionData);
        
        // 활성 구독이 있으면 그것을, 없으면 취소된 구독 정보를 사용
        const subscriptionToUse = subscriptionData.activeSubscription || subscriptionData.cancelledSubscription;
        setSubscriptionInfo(subscriptionToUse);
        
        console.log("🔍 사용할 구독 정보:", subscriptionToUse);
      } else {
        console.error("🔍 구독 정보 API 실패:", subscriptionResponse.status);
      }
    } catch (error) {
      console.error("플랜/구독 정보 조회 오류:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchUserPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // 페이지 포커스 시 구독 정보 새로고침 (롤백 후 상태 반영을 위해)
  useEffect(() => {
    const handleFocus = () => {
      console.log('페이지 포커스 감지, 구독 정보 새로고침...');
      fetchUserPlan();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // 다음 결제일 포맷팅 (구독 중일 때)
  const formatNextBillingDate = (dateString?: string) => {
    if (!dateString) return "매월 자동 결제";
    try {
      const date = new Date(dateString);
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
      return `${y}년 ${m}월 ${d}일에 자동 결제`;
    } catch {
      return "매월 자동 결제";
    }
  };

  // 구독 취소 후 전환 예정일 포맷팅
  const formatPlanChangeDate = (dateString?: string) => {
    if (!dateString) return "날짜 정보 없음";
    try {
      const date = new Date(dateString);
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
      return `${y}년 ${m}월 ${d}일에 자동으로 Basic Plan으로 전환됩니다`;
    } catch {
      return "날짜 정보 없음";
    }
  };

  // 구독 해제
  const handleCancelSubscription = async () => {
    if (!subscriptionInfo?.subscriptionId) {
      alert("구독 정보를 찾을 수 없습니다.");
      return;
    }
    if (
      confirm(
        "정말로 정기결제를 해제하시겠습니까?\n\n해제 후에는 다음 결제일까지 서비스를 이용할 수 있습니다."
      )
    ) {
      setCancelingSubscription(true);
      try {
        const response = await fetch("/api/payments/cancel-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriptionId: subscriptionInfo.subscriptionId,
            reason: "사용자 요청",
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          alert("정기결제가 성공적으로 해제되었습니다.");
          await fetchUserPlan(); // 최신 상태 갱신
        } else {
          alert(`구독 해제 실패: ${result.message || "알 수 없는 오류가 발생했습니다."}`);
        }
      } catch (error) {
        console.error("구독 해제 오류:", error);
        alert("구독 해제 중 오류가 발생했습니다.");
      } finally {
        setCancelingSubscription(false);
      }
    }
  };

  // 수동 플랜 전환 (즉시 Basic Plan으로 전환)
  const handleManualPlanChange = async () => {
    if (!subscriptionInfo?.subscriptionId) {
      alert("구독 정보를 찾을 수 없습니다.");
      return;
    }
    if (
      confirm(
        "즉시 Basic Plan으로 전환하시겠습니까?\n\n전환 후에는 현재 플랜의 혜택을 더 이상 이용할 수 없습니다."
      )
    ) {
      setChangingPlan(true);
      try {
        const response = await fetch("/api/payments/auto-plan-change", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriptionId: subscriptionInfo.subscriptionId,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          alert("Basic Plan으로 성공적으로 전환되었습니다.");
          await fetchUserPlan(); // 최신 상태 갱신
        } else {
          alert(`플랜 전환 실패: ${result.message || "알 수 없는 오류가 발생했습니다."}`);
        }
      } catch (error) {
        console.error("플랜 전환 오류:", error);
        alert("플랜 전환 중 오류가 발생했습니다.");
      } finally {
        setChangingPlan(false);
      }
    }
  };

  // 플랜 메타
  const plans = [
    {
      id: "basic",
      name: "Basic Plan",
      price: "0원",
      period: "무료",
      description: "기본 기능을 무료로 이용",
      features: ["월 2회 이미지 생성", "월 1회 영상 생성", "기본 AI 도구 사용", "커뮤니티 읽기", "이메일 지원"],
      color: "from-blue-400 to-blue-600",
      popular: false,
    },
    {
      id: "standard",
      name: "Standard Plan",
      price: "15,900원",
      period: "월",
      description: "개인 사용자를 위한 표준 플랜",
      features: [
        "월 120회 이미지 생성",
        "월 20회 영상 생성",
        "모든 AI 도구 사용",
        "우선 고객 지원",
        "고급 분석 기능",
        "커뮤니티 글쓰기",
        "광고 제거",
      ],
      color: "from-yellow-400 to-orange-500",
      popular: true,
    },
    {
      id: "pro",
      name: "Pro Plan",
      price: "29,000원",
      period: "월",
      description: "팀과 기업을 위한 고급 기능",
      features: [
        "월 300회 이미지 생성",
        "월 45회 영상 생성",
        "모든 AI 도구 사용",
        "API 접근",
        "전용 고객 지원",
        "팀 관리 기능",
        "고급 분석 대시보드",
        "맞춤형 통합",
      ],
      color: "from-purple-400 to-pink-500",
      popular: false,
    },
  ] as const;

  const currentPlan = (userPlanInfo?.planType || "basic").toLowerCase();

  const getCurrentPlanInfo = () => {
    if (!userPlanInfo) {
      return {
        name: "Basic Plan",
        displayName: "Basic",
        color: "from-blue-400 to-blue-600",
        description: "기본 기능을 무료로 이용하고 계십니다.",
      };
    }
    return {
      name: userPlanInfo.planInfo.name,
      displayName: userPlanInfo.planInfo.displayName,
      color: userPlanInfo.planInfo.color,
      description:
        userPlanInfo.planType.toLowerCase() === "basic"
          ? "기본 기능을 무료로 이용하고 계십니다."
          : `${userPlanInfo.planInfo.name}을 이용하고 계십니다.`,
    };
  };

  const currentPlanInfo = getCurrentPlanInfo();

  // 디버깅 로그
  console.log("🔍 Plan Page Debug:", {
    userPlanInfo,
    currentPlan,
    userPlanInfoType: userPlanInfo?.planType,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4" />
          <p className="text-gray-600">플랜 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full">
                <Crown className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">플랜 선택</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {session?.user?.name || "사용자"}님을 위한 최적의 플랜을 선택하세요
            </p>
          </div>

          {/* 현재 플랜 상태 */}
          <div className="max-w-md mx-auto mb-8">
            <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-yellow-400">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">현재 플랜</h3>
                <div
                  className={`flex items-center space-x-2 px-3 py-1 bg-gradient-to-r ${currentPlanInfo.color} rounded-full text-white text-sm font-medium`}
                >
                  <Crown className="w-4 h-4" />
                  <span>{currentPlanInfo.displayName} Plan</span>
                </div>
              </div>
                             <p className="text-gray-600 mb-4">{currentPlanInfo.description}</p>
               
                               {/* 구독 상태별 추가 설명 */}
                {(subscriptionInfo?.status === "inactive" || subscriptionInfo?.isCancelled) && currentPlan !== "basic" && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">구독이 취소되었습니다</p>
                        <p>다음 결제일까지 현재 플랜의 혜택을 계속 이용할 수 있습니다.</p>
                      </div>
                    </div>
                  </div>
                )}
                                             <div className="text-sm text-gray-500 mb-4">
                  {currentPlan === "basic" ? (
                    // Basic Plan인 경우
                    "무료 플랜"
                  ) : subscriptionInfo ? (
                    // 구독 정보가 있는 경우
                    subscriptionInfo.status === "inactive" || subscriptionInfo.isCancelled ? (
                      // 구독이 취소된 경우
                      <span className="text-blue-600 font-medium">
                        {formatPlanChangeDate(subscriptionInfo.planChangeDate || subscriptionInfo.nextBillingDate)}
                      </span>
                    ) : (
                      // 활성 구독인 경우
                      <span className="text-gray-700">
                        {formatNextBillingDate(subscriptionInfo.nextBillingDate)}
                      </span>
                    )
                  ) : (
                    "구독 정보를 불러올 수 없습니다"
                  )}
                </div>

                             {/* 구독 해제 버튼 */}
               {currentPlan !== "basic" && subscriptionInfo && subscriptionInfo.status === "active" && !subscriptionInfo.isCancelled && (
                 <button
                   onClick={handleCancelSubscription}
                   className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                   disabled={cancelingSubscription}
                 >
                   <X className="w-4 h-4" />
                   <span>{cancelingSubscription ? "해제 중..." : "정기결제 해제"}</span>
                   {cancelingSubscription && (
                     <div className="ml-2 animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                   )}
                 </button>
               )}

               {/* 수동 플랜 전환 버튼 (구독 해제 후) */}
               {currentPlan !== "basic" && subscriptionInfo && (subscriptionInfo.status === "inactive" || subscriptionInfo.isCancelled) && (
                 <button
                   onClick={handleManualPlanChange}
                   className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                   disabled={changingPlan}
                 >
                   <Zap className="w-4 h-4" />
                   <span>{changingPlan ? "전환 중..." : "즉시 Basic Plan으로 전환"}</span>
                   {changingPlan && (
                     <div className="ml-2 animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                   )}
                 </button>
               )}
            </div>
          </div>

          {/* 결제 메시지 */}
          {paymentMessage && (
            <div className="max-w-md mx-auto mb-8">
              <div
                className={`rounded-xl p-4 ${
                  paymentMessage.type === "success"
                    ? "bg-green-100 border border-green-400 text-green-700"
                    : "bg-red-100 border border-red-400 text-red-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{paymentMessage.message}</span>
                  <button onClick={() => setPaymentMessage(null)} className="text-gray-500 hover:text-gray-700">
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
                  plan.popular ? "ring-2 ring-yellow-400 scale-105" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center space-x-1 shadow-lg">
                      <Star className="w-4 h-4" />
                      <span>인기</span>
                    </div>
                  </div>
                )}

                <div className={`p-8 ${plan.popular ? "pt-16" : "pt-8"}`}>
                  {/* 플랜 헤더 */}
                  <div className="text-center mb-8">
                    <div className={`inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r ${plan.color} rounded-full mb-4`}>
                      {plan.id === "basic" && <Shield className="w-8 h-8 text-white" />}
                      {plan.id === "standard" && <Zap className="w-8 h-8 text-white" />}
                      {plan.id === "pro" && <Crown className="w-8 h-8 text-white" />}
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
                    ) : plan.id === "basic" && (currentPlan === "standard" || currentPlan === "pro") ? (
                      <div className="w-full h-14 flex items-center justify-center text-gray-400 text-sm">현재 유료 플랜 사용 중</div>
                    ) : plan.id === "basic" && currentPlan === "basic" ? (
                      <button
                        className="w-full py-4 px-6 rounded-xl font-semibold transition-all duration-200 h-14 flex items-center justify-center bg-gray-200 text-gray-500 cursor-not-allowed"
                        disabled
                      >
                        현재 플랜
                      </button>
                    ) : plan.id === "basic" ? (
                      <button
                        className="w-full py-4 px-6 rounded-xl font-semibold transition-all duration-200 h-14 flex items-center justify-center bg-gray-900 text-white hover:bg-gray-800 transform hover:-translate-y-1"
                        onClick={async () => {
                          try {
                            const response = await fetch("/api/user/plan", {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ planType: "basic" }),
                            });
                            if (response.ok) {
                              setPaymentMessage({ type: "success", message: "Basic 플랜으로 전환되었습니다!" });
                              fetchUserPlan();
                            } else {
                              setPaymentMessage({ type: "error", message: "플랜 전환에 실패했습니다." });
                            }
                          } catch (error) {
                            console.error("플랜 전환 오류:", error);
                            setPaymentMessage({ type: "error", message: "플랜 전환 중 오류가 발생했습니다." });
                          }
                        }}
                      >
                        무료로 시작
                      </button>
                                         ) : (currentPlan === "standard" || currentPlan === "pro") && plan.id !== currentPlan ? (
                       // 유료 플랜 사용 중일 때 다른 유료 플랜 선택 시
                       <div className="w-full h-14 flex items-center justify-center text-center">
                         <div className="text-sm text-gray-600">기존 구독 해제 후 이용 가능</div>
                       </div>
                    ) : (
                      <PaymentButton
                        planId={plan.id}
                        planName={plan.name}
                        amount={plan.id === "standard" ? 15900 : plan.id === "pro" ? 29000 : 0}
                        currentPlan={currentPlan}
                        onSuccess={() => {
                          setPaymentMessage({ type: "success", message: "플랜 업그레이드가 완료되었습니다!" });
                          fetchUserPlan();
                        }}
                        onError={(error) => {
                          setPaymentMessage({ type: "error", message: error });
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ 섹션 */}
          <div className="max-w-4xl mx-auto mt-16">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">자주 묻는 질문</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">언제든지 플랜을 변경할 수 있나요?</h3>
                <p className="text-gray-600">네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 변경사항은 즉시 적용됩니다.</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">환불 정책은 어떻게 되나요?</h3>
                <p className="text-gray-600">구매 후 7일 이내에 100% 환불을 제공합니다. 단, 사용량이 많지 않은 경우에만 적용됩니다.</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">팀 플랜은 어떻게 작동하나요?</h3>
                <p className="text-gray-600">Pro 플랜에서는 팀원을 초대하여 함께 사용할 수 있습니다. 팀 관리 기능을 통해 사용량을 모니터링할 수 있습니다.</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">결제 방법은 어떤 것이 있나요?</h3>
                <p className="text-gray-600">신용카드, 체크카드, 간편결제(카카오페이, 네이버페이), 계좌이체 등 다양한 결제 방법을 지원합니다.</p>
              </div>
            </div>
          </div>

          {/* 고객 지원 */}
          <div className="text-center mt-16">
            <p className="text-gray-600 mb-4">추가 질문이 있으시면 언제든지 문의해 주세요</p>
            <Link
              href="/contact"
              className="inline-flex items-center space-x-2 bg-gray-900 text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <span>고객 지원 문의</span>
            </Link>
                     </div>
         </div>
       </div>
     </div>
     </>
   );
 }
