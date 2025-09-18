'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface PaymentResult {
  success: boolean;
  message: string;
  billingKey?: string;
  subscriptionId?: string;
  nextBillingDate?: string;
  error?: string;
  code?: string;
  details?: {
    status: string;
    response: any;
  };
}

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [sessionRecovering, setSessionRecovering] = useState(false);

  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const customerKey = searchParams.get('customerKey');
  const authKey = searchParams.get('authKey'); // 토스페이먼츠에서 전달하는 실제 billingAuthKey
  const billingAuthKey = searchParams.get('billingAuthKey'); // 추가 파라미터 (사용되지 않음)

  useEffect(() => {
    // 결제가 이미 완료된 경우 로컬 스토리지만 저장하고 즉시 종료
    if (result?.success) {
      console.log('결제가 이미 완료되었습니다. 로컬 스토리지에 상태를 저장합니다.');
      localStorage.setItem('paymentCompleted', 'true');
      return;
    }

    // 로컬 스토리지에서 결제 완료 상태 확인 (디버깅을 위해 로그 추가)
    const paymentCompleted = localStorage.getItem('paymentCompleted');
    console.log('로컬 스토리지 상태 확인:', { paymentCompleted, resultSuccess: result?.success });
    
    // 로컬 스토리지가 true이지만 실제로는 결제가 진행 중인 경우 초기화
    if (paymentCompleted === 'true' && !result?.success) {
      console.log('로컬 스토리지가 잘못 설정되어 있습니다. 초기화합니다.');
      localStorage.removeItem('paymentCompleted');
    }
    
    // 로컬 스토리지에서 결제 완료 상태 확인 (초기화 후)
    if (localStorage.getItem('paymentCompleted') === 'true') {
      console.log('로컬 스토리지에서 결제 완료 상태를 확인했습니다. 세션 복구를 건너뜁니다.');
      return;
    }

    // HMR로 인한 세션 초기화 방지 - 세션 복구 완전 차단
    if (!session && typeof window !== 'undefined') {
      console.log('세션이 없습니다. HMR로 인한 초기화일 수 있습니다.');
      
      // 로컬 스토리지에서 결제 완료 상태 재확인
      if (localStorage.getItem('paymentCompleted') === 'true') {
        console.log('로컬 스토리지에서 결제 완료 상태를 재확인했습니다. 세션 복구를 완전히 차단합니다.');
        return;
      }
      
      // 결제 진행 중인 경우에만 세션 복구 시도 (결제 완료된 경우는 절대 시도하지 않음)
      if (!result?.success) {
        console.log('결제가 진행 중입니다. 세션 복구를 시도합니다...');
        
        const checkSession = async () => {
          setSessionRecovering(true);
          let sessionRecovered = false;
          
          // 빠른 복구 시도 (3초)
          for (let i = 0; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 매번 결제 완료 상태 확인
            if (result?.success || localStorage.getItem('paymentCompleted') === 'true') {
              console.log('세션 복구 중 결제 완료 감지! 세션 복구를 즉시 중단합니다.');
              setSessionRecovering(false);
              return;
            }
            
            if (session) {
              console.log('세션이 복구되었습니다.');
              sessionRecovered = true;
              break;
            }
          }
          
          // 느린 복구 시도 (추가 7초)
          if (!sessionRecovered) {
            console.log('세션 복구를 계속 시도합니다... (추가 7초)');
            for (let i = 0; i < 14; i++) {
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // 매번 결제 완료 상태 확인
              if (result?.success || localStorage.getItem('paymentCompleted') === 'true') {
                console.log('세션 복구 중 결제 완료 감지! 세션 복구를 즉시 중단합니다.');
                setSessionRecovering(false);
                return;
              }
              
              if (session) {
                console.log('세션이 복구되었습니다.');
                sessionRecovered = true;
                break;
              }
            }
          }
          
          // 세션 복구 실패 시에도 로그인 페이지로 이동하지 않음
          if (!sessionRecovered) {
            console.log('세션 복구 실패. 하지만 결제가 진행 중이므로 로그인 페이지로 이동하지 않습니다.');
            setSessionRecovering(false);
            return;
          }
          
          setSessionRecovering(false);
          console.log('세션 복구 성공! 빌링키 발급 프로세스를 시작합니다.');
          startBillingProcess();
        };
        
        checkSession();
        return;
      } else {
        console.log('결제가 이미 완료되었습니다. 세션 복구를 시도하지 않습니다.');
        return;
      }
    }

    // 세션이 있는 경우 바로 시작
    if (session) {
      console.log('세션이 있습니다. 빌링키 발급 프로세스를 시작합니다.');
    }

    if (!orderId || !amount || !customerKey || !authKey) {
      setError('필수 결제 정보가 누락되었습니다. authKey(billingAuthKey)가 필요합니다.');
      setLoading(false);
      return;
    }

    console.log('모든 파라미터 확인됨. 빌링키 발급 프로세스를 시작합니다.');
    
    // 세션이 있는 경우 바로 시작
    startBillingProcess();
  }, [session, orderId, amount, customerKey, authKey, result?.success]); // result.success만 의존성으로 추가

  // 결제 완료 후 자동 이동을 위한 useEffect
  useEffect(() => {
    if (result?.success) {
      // 로컬 스토리지에서 결제 완료 상태 제거
      localStorage.removeItem('paymentCompleted');
      
      // 3초 후 플랜 페이지로 이동
      const timer = setTimeout(() => {
        router.push('/plan');
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [result?.success, router]);

  // 빌링키 발급 프로세스 시작 함수
  const startBillingProcess = () => {
    // 빌링키 발급 프로세스 시작 (즉시 시작)
    setTimeout(() => {
      processBillingAuth();
    }, 2000); // 2초 지연으로 단축 (기존 60초에서 대폭 단축)
  };

  const processBillingAuth = async () => {
    try {
      setLoading(true);
      console.log('빌링키 발급 프로세스 시작:', { orderId, amount, customerKey, authKey });
      console.log('토스페이먼츠 공식 가이드: URL의 authKey가 실제 billingAuthKey입니다.');

      // 1. 주문 정보에서 플랜 정보 조회
      if (!orderId) {
        throw new Error('주문 ID가 누락되었습니다.');
      }
      const planId = await getPlanIdFromOrder(orderId);
      if (!planId) {
        throw new Error('주문 정보를 찾을 수 없습니다.');
      }

      // 2. 빌링키 발급 API 호출
      const response = await fetch('/api/payments/billing-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingAuthKey: authKey || '', // URL의 authKey가 실제 billingAuthKey
          orderId: orderId || '',
          amount: parseInt(amount || '0'),
          planId: planId || '',
          customerKey: customerKey || ''
        })
      });

      const result = await response.json();
      console.log('빌링키 발급 API 응답:', result);

      if (response.ok && result.success) {
        setResult(result);
        // 빌링키 발급 직후 첫 결제(당월 청구) 실행
        try {
          const planIdForCharge = planId || (await getPlanIdFromOrder(orderId || '')) || 'standard';
          await executeInitialCharge(result.billingKey, parseInt(amount || '0'), orderId || '', planIdForCharge);
        } catch (chargeError) {
          console.error('첫 결제 실행 오류:', chargeError);
          setError(chargeError instanceof Error ? chargeError.message : '첫 결제 실행 중 오류가 발생했습니다.');
          return;
        }
        // 성공 시 3초 후 플랜 페이지로 이동
        setTimeout(() => {
          router.push('/plan');
        }, 3000);
      } else {
        // 빌링키 발급 실패 시 재시도 로직
        if (retryCount < 3) {
          console.log(`빌링키 발급 실패, ${retryCount + 1}번째 재시도...`);
          console.log('실패 상세 정보:', result.details);
          setRetryCount(prev => prev + 1);
          setTimeout(() => {
            processBillingAuth();
          }, 120000); // 120초 후 재시도 (더 긴 대기 시간)
          return;
        }
        
        // 최종 실패 시 상세 오류 정보 표시
        let errorMessage = result.error;
        
        // API Key 오류인 경우 특별한 안내 추가
        if (result.code === 'COMMON_INVALID_API_KEY') {
          errorMessage = 'API Key 오류: 토스페이먼츠 대시보드에서 올바른 API Key를 확인해주세요.\n\n' +
                        '• 테스트 환경: test_로 시작하는 API Key\n' +
                        '• 운영 환경: live_로 시작하는 API Key';
        }
        
        const errorDetails = result.details ? `\n\n상세 정보:\n상태: ${result.details.status}\n응답: ${JSON.stringify(result.details.response, null, 2)}` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }

    } catch (error) {
      console.error('빌링키 발급 프로세스 오류:', error);
      setError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 빌링키 발급 직후 첫 결제를 실행
  const executeInitialCharge = async (billingKey: string, amountNum: number, baseOrderId: string, planIdStr: string) => {
    if (!billingKey || !amountNum || !baseOrderId) {
      throw new Error('첫 결제 정보가 부족합니다.');
    }
    const initialOrderId = `subscription_first_${baseOrderId}`;
    const orderName = `MOA ${planIdStr} 플랜 첫 결제`;

    // Idempotency: 이미 처리한 기록이 있으면 재호출 방지
    const storageKey = `paid_${initialOrderId}`;
    if (localStorage.getItem(storageKey) === 'done') {
      console.log('이미 처리된 첫 결제입니다. 재호출을 건너뜁니다.');
      return;
    }

    const execRes = await fetch('/api/billing/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billingKey, amount: amountNum, orderId: initialOrderId, orderName, customerKey, planType: planIdStr })
    });
    const execJson = await execRes.json();
    console.log('첫 결제 실행 결과:', execJson);
    if (!execRes.ok || !execJson.success) {
      throw new Error(execJson.error || '첫 결제 승인에 실패했습니다.');
    }
    localStorage.setItem(storageKey, 'done');
  };

  const getPlanIdFromOrder = async (orderId: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/payments/order-info?orderId=${orderId}`);
      if (response.ok) {
        const data = await response.json();
        return data.planId;
      }
    } catch (error) {
      console.error('주문 정보 조회 오류:', error);
    }
    return null;
  };

  const handleRetry = () => {
    setError(null);
    setResult(null);
    setRetryCount(0);
    processBillingAuth();
  };

  const handleGoHome = () => {
    router.push('/plan');
  };

  // 로컬 스토리지 초기화 함수 (디버깅용)
  const handleResetLocalStorage = () => {
    localStorage.removeItem('paymentCompleted');
    console.log('로컬 스토리지가 초기화되었습니다. 페이지를 새로고침하세요.');
    window.location.reload();
  };

  const handleManualRetry = () => {
    // 수동으로 다시 시도 (더 긴 대기 시간)
    setError(null);
    setResult(null);
    setRetryCount(0);
    setTimeout(() => {
      processBillingAuth();
    }, 300000); // 300초 대기 (5분)
  };

  // 세션 복구 중일 때 표시
  if (sessionRecovering) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-pulse rounded-full h-12 w-12 bg-blue-200 mx-auto mb-4 flex items-center justify-center">
              <div className="w-6 h-6 bg-blue-600 rounded-full"></div>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              세션 복구 중...
            </h2>
            <p className="text-gray-600 mb-4">
              결제 진행을 위해 로그인 상태를 복구하고 있습니다.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <span className="font-medium">🎉</span> MOA를 구독해주셔서 감사합니다.
                <br />
                잠시만 기다려주세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              {retryCount > 0 ? `빌링키 발급 재시도 중... (${retryCount}/3)` : '빌링키 발급 준비 중...'}
            </h2>
            <p className="text-gray-600">
              {retryCount > 0 ? '토스페이먼츠 인증 완료를 기다리는 중입니다.' : '토스페이먼츠 카드 인증 완료를 기다리는 중입니다. (60초)'}
            </p>
            {retryCount > 0 && (
              <p className="text-sm text-blue-600 mt-2">
                토스페이먼츠에서 카드 인증을 완료하는 데 시간이 걸릴 수 있습니다.
                <br />
                현재 {retryCount}번째 시도 중입니다.
              </p>
            )}
            
            {/* 로컬 스토리지 초기화 버튼 (디버깅용) */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-3">문제가 발생한 경우:</p>
              <button
                onClick={handleResetLocalStorage}
                className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                🔄 로컬 스토리지 초기화
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">결제 실패</h2>
            <p className="text-gray-600 mb-6 whitespace-pre-line">{error}</p>
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                다시 시도하기
              </button>
              <button
                onClick={handleManualRetry}
                className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors"
              >
                더 오래 기다린 후 재시도
              </button>
              <button
                onClick={handleGoHome}
                className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
              >
                홈으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">구독 완료!</h2>
            <p className="text-gray-600 mb-4">{result.message}</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">구독 ID:</span> {result.subscriptionId}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">다음 결제일:</span> {new Date(result.nextBillingDate!).toLocaleDateString('ko-KR')}
              </p>
            </div>
            <p className="text-sm text-blue-600 mb-4">
              3초 후 플랜 페이지로 이동합니다...
            </p>
            <button
              onClick={handleGoHome}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              바로 이동하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="text-yellow-500 text-6xl mb-4">❓</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">처리 중</h2>
          <p className="text-gray-600 mb-6">결제 정보를 확인하고 있습니다.</p>
          <button
            onClick={handleGoHome}
            className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" /><p className="text-gray-600">결제 결과 확인 중...</p></div></div></div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}