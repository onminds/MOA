"use client";

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-6">개인정보처리방침</h1>
        <p className="text-gray-600 mb-10">주식회사 온마인즈(이하 "회사")는 이용자의 개인정보를 소중히 여기며, 개인정보보호법 등 관계 법령을 준수합니다. 본 방침은 회사가 제공하는 MOA 서비스와 관련하여 개인정보의 수집·이용·보관·제공에 관한 기준을 설명합니다.</p>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">1. 수집하는 개인정보의 항목</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>필수항목: 이메일, 비밀번호(해시), 이름/닉네임, 서비스 이용기록, 결제/구독 정보</li>
            <li>선택항목: 프로필 이미지, 연락처, 직무/관심사</li>
            <li>자동수집: IP 주소, 기기/브라우저 정보, 접속 일시, 쿠키, 로그 데이터</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">2. 개인정보의 수집 방법</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>회원 가입 및 서비스 이용 과정에서 이용자가 직접 입력</li>
            <li>API 연동, 결제 모듈, 고객센터 상담 등 서비스 제공 과정에서 생성·수집</li>
            <li>쿠키 및 유사기술을 통한 자동 수집</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">3. 개인정보의 이용 목적</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>회원 식별, 서비스 제공 및 운영, 고객지원</li>
            <li>결제/과금, 사용량 관리, 구독 갱신 및 청구</li>
            <li>보안, 부정사용 방지, 서비스 개선 및 통계 분석</li>
            <li>공지사항 전달, 이벤트/혜택 안내(수신 동의 시)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">4. 보유 및 이용 기간</h2>
          <p className="text-gray-700 mb-2">원칙적으로 개인정보의 처리 목적이 달성되면 지체 없이 파기합니다. 단, 다음의 경우 법령에 따라 일정 기간 보관할 수 있습니다.</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>계약 또는 청약 철회 등에 관한 기록: 5년</li>
            <li>대금 결제 및 재화 등의 공급에 관한 기록: 5년</li>
            <li>소비자 불만 또는 분쟁 처리에 관한 기록: 3년</li>
            <li>로그인 기록(접속기록): 1년</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">5. 개인정보의 제3자 제공</h2>
          <p className="text-gray-700">회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 법령에 근거하거나 이용자의 동의가 있는 경우에 한하여 제공할 수 있습니다.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">6. 개인정보 처리의 위탁</h2>
          <p className="text-gray-700 mb-2">원활한 서비스 제공을 위해 일부 업무를 외부 전문 업체에 위탁할 수 있으며, 위탁 시 개인정보보호 관련 법령에 따라 안전하게 관리되도록 합니다.</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>인증/로그인: Google, Kakao (OAuth)</li>
            <li>결제 처리: 토스페이먼츠, Bootpay</li>
            <li>클라우드/호스팅: Vercel 등</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">7. 국외 이전</h2>
          <p className="text-gray-700">일부 서비스(예: Vercel, OpenAI 등)의 서버가 해외에 위치할 수 있으며, 이에 따라 필요한 범위 내에서 개인정보가 국외로 이전될 수 있습니다. 회사는 법령이 요구하는 절차에 따라 적절한 보호조치를 시행합니다.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">8. 정보주체의 권리</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.</li>
            <li>회원 탈퇴 시 지체 없이 개인정보를 파기하며, 관련 법령에 따른 의무 보관 정보는 예외로 합니다.</li>
            <li>권리 행사는 고객센터 또는 이메일(company@onminds.net)을 통해 요청하실 수 있습니다.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">9. 개인정보의 안전성 확보조치</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>개인정보의 암호화 저장, 전송 구간 암호화(HTTPS)</li>
            <li>접근 통제 및 권한 관리, 2단계 인증(적용 시)</li>
            <li>보안 취약점 점검, 로그 모니터링</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">10. 쿠키의 사용</h2>
          <p className="text-gray-700">회사는 이용자의 편의와 맞춤형 서비스 제공을 위해 쿠키를 사용할 수 있습니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다.</p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-bold mb-2">11. 청소년 보호</h2>
          <p className="text-gray-700">만 14세 미만 아동은 법정대리인의 동의가 있어야 회원가입이 가능합니다. 회사는 법정대리인의 동의 없이 수집된 것으로 확인된 개인정보에 대해서는 지체 없이 삭제합니다.</p>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-bold mb-2">12. 고지 및 문의</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>개인정보 관련 문의: company@onminds.net</li>
            <li>주소: 수원시 통달구 갓매산로 51, 6층</li>
            <li>시행일: 2025-01-01</li>
          </ul>
        </section>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <Link href="/" className="hover:underline">← 메인으로</Link>
          <div className="space-x-4">
            <Link href="/terms" className="hover:underline">이용약관 보기 →</Link>
            <Link href="/refund-policy" className="hover:underline">환불 규정 보기 →</Link>
          </div>
        </div>
      </div>
    </div>
  );
} 