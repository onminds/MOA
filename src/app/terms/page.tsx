"use client";

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-6">MOA 서비스 이용약관</h1>
        <p className="text-gray-600 mb-10">본 약관은 주식회사 온마인즈(이하 "회사")가 제공하는 MOA 및 관련 서비스의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>

        <nav className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-10">
          <h2 className="font-semibold mb-2">목차</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm text-gray-700">
            <li><a href="#1" className="hover:underline">제1조(목적)</a></li>
            <li><a href="#2" className="hover:underline">제2조(정의)</a></li>
            <li><a href="#3" className="hover:underline">제3조(약관의 게시와 개정)</a></li>
            <li><a href="#4" className="hover:underline">제4조(서비스의 제공)</a></li>
            <li><a href="#5" className="hover:underline">제5조(계정 및 보안)</a></li>
            <li><a href="#6" className="hover:underline">제6조(이용자의 의무)</a></li>
            <li><a href="#7" className="hover:underline">제7조(유료서비스 및 결제)</a></li>
            <li><a href="#8" className="hover:underline">제8조(구독, 갱신, 해지 및 환불)</a></li>
            <li><a href="#9" className="hover:underline">제9조(콘텐츠의 권리와 책임)</a></li>
            <li><a href="#10" className="hover:underline">제10조(개인정보의 보호)</a></li>
            <li><a href="#11" className="hover:underline">제11조(서비스 이용 제한)</a></li>
            <li><a href="#12" className="hover:underline">제12조(면책조항)</a></li>
            <li><a href="#13" className="hover:underline">제13조(손해배상)</a></li>
            <li><a href="#14" className="hover:underline">제14조(분쟁해결 및 관할)</a></li>
            <li><a href="#15" className="hover:underline">제15조(고지 및 통지)</a></li>
            <li><a href="#16" className="hover:underline">부칙</a></li>
          </ul>
        </nav>

        <section id="1" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제1조(목적)</h3>
          <p className="text-gray-700">본 약관은 회사가 제공하는 MOA 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
        </section>

        <section id="2" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제2조(정의)</h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>"회원"이라 함은 본 약관에 동의하고 서비스 이용계약을 체결하여 계정을 부여받은 자를 말합니다.</li>
            <li>"유료서비스"란 구독, 충전, 결제 등을 통해 대가를 지급하고 이용하는 서비스를 말합니다.</li>
            <li>"콘텐츠"란 회원이 서비스 내에서 업로드, 작성, 생성, 공유하는 정보 일체를 의미합니다.</li>
            <li>"구독"이란 정기적으로 대가를 지급하여 일정 기간 동안 서비스를 이용할 수 있는 계약을 말합니다.</li>
          </ul>
        </section>

        <section id="3" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제3조(약관의 게시와 개정)</h3>
          <p className="text-gray-700">회사는 본 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기화면 또는 연결화면에 게시합니다. 회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 사전 고지합니다.</p>
        </section>

        <section id="4" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제4조(서비스의 제공)</h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>서비스는 AI 도구 검색, 이미지/비디오 생성, 요약/분석, 커뮤니티 등으로 구성됩니다.</li>
            <li>회사는 서비스의 품질 향상을 위해 기능을 추가·변경하거나 중단할 수 있습니다.</li>
            <li>베타 기능은 안정성, 정확성, 가용성이 보장되지 않을 수 있습니다.</li>
          </ul>
        </section>

        <section id="5" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제5조(계정 및 보안)</h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>회원은 계정 정보(이메일, 비밀번호 등)를 안전하게 관리할 의무가 있습니다.</li>
            <li>제3자 공유, 양도, 대여는 금지됩니다.</li>
            <li>침해가 의심될 경우 즉시 비밀번호를 변경하고 회사에 통지해야 합니다.</li>
          </ul>
        </section>

        <section id="6" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제6조(이용자의 의무)</h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>법령 및 본 약관, 공지사항을 준수해야 합니다.</li>
            <li>타인의 권리를 침해하는 콘텐츠를 게시·전송·배포해서는 안 됩니다.</li>
            <li>자동화 수단을 통한 무단 수집/스크래핑/크롤링은 금지됩니다.</li>
            <li>서비스의 정상적인 운영을 방해하는 행위는 금지됩니다.</li>
          </ul>
        </section>

        <section id="7" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제7조(유료서비스 및 결제)</h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>유료서비스의 가격, 제공 내용, 이용 조건은 서비스 내 고지된 정책을 따릅니다.</li>
            <li>정기 결제의 경우 약정된 주기에 따라 자동으로 결제가 이루어집니다.</li>
            <li>결제 수단은 신용/체크카드, 간편결제 등 회사가 정한 방식으로 할 수 있습니다.</li>
            <li>부정 결제 탐지 시 즉시 이용을 제한할 수 있습니다.</li>
          </ul>
        </section>

        <section id="8" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제8조(구독, 갱신, 해지 및 환불)</h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>구독은 결제일을 기점으로 동일 주기로 갱신됩니다.</li>
            <li>해지는 다음 결제 예정일 이전에 진행해야 하며, 해지 시 잔여 기간은 만료일까지 유지됩니다.</li>
            <li>법령 및 소비자분쟁해결기준이 정하는 범위 내에서 환불이 가능합니다.</li>
            <li>이미 제공된 서비스 또는 사용된 크레딧은 환불 대상에서 제외될 수 있습니다.</li>
          </ul>
        </section>

        <section id="9" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제9조(콘텐츠의 권리와 책임)</h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>회원이 업로드한 콘텐츠의 저작권은 원칙적으로 회원에게 귀속합니다.</li>
            <li>회사는 서비스 운영, 홍보를 위해 필요한 범위에서 해당 콘텐츠를 사용할 수 있습니다.</li>
            <li>타인의 권리를 침해하는 콘텐츠로 인해 발생하는 분쟁과 책임은 게시자에게 있습니다.</li>
          </ul>
        </section>

        <section id="10" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제10조(개인정보의 보호)</h3>
          <p className="text-gray-700">회사는 개인정보보호법 등 관련 법령에 따라 회원의 개인정보를 보호하며, 구체적인 사항은 개인정보처리방침을 따릅니다.</p>
        </section>

        <section id="11" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제11조(서비스 이용 제한)</h3>
          <p className="text-gray-700">회사는 다음 각 호에 해당하는 경우 사전 통지 없이 서비스 이용을 제한하거나 계정을 해지할 수 있습니다.</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>약관 또는 법령을 위반하는 경우</li>
            <li>타인의 권리 침해, 사칭, 불법 행위가 확인된 경우</li>
            <li>시스템에 과도한 부하를 초래하거나 보안 위협이 되는 행위를 하는 경우</li>
          </ul>
        </section>

        <section id="12" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제12조(면책조항)</h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-1">
            <li>천재지변, 정전, IDC 장애 등 불가항력으로 인한 손해에 대해서는 책임을 지지 않습니다.</li>
            <li>회원의 귀책 사유로 발생한 손해에 대해서는 책임을 지지 않습니다.</li>
            <li>베타/실험적 기능의 정확성, 적합성, 가용성은 보장되지 않습니다.</li>
          </ul>
        </section>

        <section id="13" className="mb-8">
          <h3 className="text-xl font-bold mb-2">제13조(손해배상)</h3>
          <p className="text-gray-700">회사의 책임 있는 사유로 회원에게 손해가 발생한 경우, 회사는 관련 법령이 허용하는 범위 내에서 실제로 입은 통상손해를 배상합니다. 다만, 회사는 간접 손해, 특별 손해, 결과적 손해에 대해서는 책임을 지지 않습니다.</p>
        </section>

        <section id="14" className="mb-12">
          <h3 className="text-xl font-bold mb-2">제14조(분쟁해결 및 관할)</h3>
          <p className="text-gray-700">회사와 회원 간 분쟁이 발생할 경우, 상호 협의로 원만히 해결함을 원칙으로 합니다. 협의가 이루어지지 않을 경우 관할 법원은 회사의 본점 소재지를 관할하는 법원으로 합니다.</p>
        </section>

        <section id="15" className="mb-12">
          <h3 className="text-xl font-bold mb-2">제15조(고지 및 통지)</h3>
          <p className="text-gray-700">회사는 서비스 내 공지사항 게시, 이메일, 알림 등을 통해 회원에게 중요한 사항을 통지할 수 있습니다. 회원은 연락처 정보가 항상 최신 상태인지 확인해야 합니다.</p>
        </section>

        <section id="16" className="mb-12">
          <h3 className="text-xl font-bold mb-2">부칙</h3>
          <p className="text-gray-700">본 약관은 2025년 1월 1일부터 적용됩니다. 회사는 필요한 경우 약관을 개정할 수 있으며, 개정 사항은 사전에 공지합니다.</p>
        </section>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <Link href="/" className="hover:underline">← 메인으로</Link>
          <Link href="/privacy" className="hover:underline">개인정보처리방침 보기 →</Link>
        </div>
      </div>
    </div>
  );
} 