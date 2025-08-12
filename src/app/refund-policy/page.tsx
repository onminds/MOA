"use client";

import Link from 'next/link';

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-6">환불 규정</h1>
        <p className="text-gray-600 mb-10">본 환불 규정은 전자상거래 등에서의 소비자보호에 관한 법률, 콘텐츠산업진흥법, 전자금융거래법, 소비자분쟁해결기준 등 관련 법령을 준수합니다.</p>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">1. 적용 대상</h2>
          <p className="text-gray-700">MOA 서비스에서 제공되는 정기 구독형 유료서비스, 크레딧/사용권 등 디지털 콘텐츠 유료 결제에 적용됩니다.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">2. 청약철회(결제 취소)</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>결제일로부터 7일 이내, 미사용 시 전액 환불 가능합니다. (전자상거래법 제17조)</li>
            <li>서비스 또는 크레딧을 사용한 경우, 사용분을 제외하고 환불하거나 환불이 제한될 수 있습니다.</li>
            <li>디지털 콘텐츠가 <span className="font-medium">즉시 제공</span>되어 실사용이 개시된 경우, 「전자상거래법 시행령 제21조 제2항」에 따라 청약철회가 제한될 수 있습니다.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">3. 정기 구독(자동결제) 환불</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>구독은 결제 주기 시작과 동시에 효력이 발생하며, 구독 중도 해지 시 다음 결제일부터 갱신이 중단됩니다.</li>
            <li>이미 개시된 구독 기간은 원칙적으로 환불되지 않으나, 서비스 장애 등 귀책 사유가 있는 경우 소비자분쟁해결기준에 따릅니다.</li>
            <li>갱신 전 해지: 다음 결제일부터 자동 갱신 중단</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">4. 서비스 장애/하자에 따른 환불</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>연속 4시간 이상, 또는 월 누적 24시간 이상 서비스 장애 발생 시 미사용 기간을 연장하거나 해당 기간 요금을 비례 환불합니다. (소비자분쟁해결기준)</li>
            <li>결함·하자 있는 콘텐츠 제공 시 지체 없이 재제공 또는 환불합니다. (콘텐츠산업진흥법)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">5. 환불 방법 및 기한</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>환불 승인일로부터 3영업일 이내 결제 수단으로 환급 처리합니다. (카드사 사정에 따라 3~7영업일 지연 가능)</li>
            <li>부분 환불의 경우 사용 금액·기간·제공된 혜택을 고려하여 산정합니다.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">6. 환불이 제한되는 경우</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>구독/크레딧을 실사용하여 복제가 가능하거나 가치가 현저히 감소한 경우</li>
            <li>이벤트/프로모션 등으로 무상 제공된 혜택만 사용한 경우</li>
            <li>법령상 청약철회가 제한되는 디지털 콘텐츠에 해당하는 경우</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">7. 부정 결제 및 오결제</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>명의 도용, 도난 카드 등 위법한 결제로 확인되면 전액 환불 및 결제 취소를 지원합니다. (전자금융거래법)</li>
            <li>오결제 확인 시 신속히 취소/환불을 진행합니다.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">8. 환불 접수 및 문의</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>고객센터 이메일: company@onminds.net</li>
            <li>전화: 010-7451-4477</li>
            <li>주소: 수원시 통달구 갓매산로 51, 6층</li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-bold mb-2">9. 부칙</h2>
          <p className="text-gray-700">본 환불 규정은 2025년 1월 1일부터 적용됩니다. 회사는 관련 법령 및 내부 정책 변화에 따라 본 규정을 개정할 수 있으며, 개정 시 사전에 공지합니다.</p>
        </section>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <Link href="/" className="hover:underline">← 메인으로</Link>
          <div className="space-x-4">
            <Link href="/privacy" className="hover:underline">개인정보처리방침 →</Link>
            <Link href="/terms" className="hover:underline">이용약관 →</Link>
          </div>
        </div>
      </div>
    </div>
  );
} 