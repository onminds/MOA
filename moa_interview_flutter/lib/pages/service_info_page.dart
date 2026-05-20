import 'package:flutter/material.dart';

class ServiceInfoPage extends StatelessWidget {
  const ServiceInfoPage({super.key});

  static const List<_ServiceDocument> _documents = <_ServiceDocument>[
    _ServiceDocument(
      title: '서비스 이용약관',
      description: '부엉 스피치 서비스를 이용하기 위한 약관 내용을 확인하세요.',
      icon: Icons.rule_rounded,
      introParagraphs: <String>[
        '본 약관은 주식회사 온마인즈(이하 "회사")가 제공하는 부엉 스피치 및 관련 서비스의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.',
      ],
      sections: <_ServiceSection>[
        _ServiceSection(
          title: '제1조(목적)',
          paragraphs: <String>[
            '본 약관은 회사가 제공하는 부엉 스피치 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.',
          ],
        ),
        _ServiceSection(
          title: '제2조(정의)',
          bullets: <String>[
            '"회원"이라 함은 본 약관에 동의하고 서비스 이용계약을 체결하여 계정을 부여받은 자를 말합니다.',
            '"유료서비스"란 구독, 충전, 결제 등을 통해 대가를 지급하고 이용하는 서비스를 말합니다.',
            '"콘텐츠"란 회원이 서비스 내에서 업로드, 작성, 생성, 공유하는 정보 일체를 의미합니다.',
            '"구독"이란 정기적으로 대가를 지급하여 일정 기간 동안 서비스를 이용할 수 있는 계약을 말합니다.',
          ],
        ),
        _ServiceSection(
          title: '제3조(약관의 게시와 개정)',
          paragraphs: <String>[
            '회사는 본 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기화면 또는 연결화면에 게시합니다. 회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 사전 고지합니다.',
          ],
        ),
        _ServiceSection(
          title: '제4조(서비스의 제공)',
          bullets: <String>[
            '서비스는 AI 도구 검색, 이미지/비디오 생성, 요약/분석, 커뮤니티 등으로 구성됩니다.',
            '회사는 서비스의 품질 향상을 위해 기능을 추가·변경하거나 중단할 수 있습니다.',
            '베타 기능은 안정성, 정확성, 가용성이 보장되지 않을 수 있습니다.',
          ],
        ),
        _ServiceSection(
          title: '제5조(계정 및 보안)',
          bullets: <String>[
            '회원은 계정 정보(이메일, 비밀번호 등)를 안전하게 관리할 의무가 있습니다.',
            '제3자 공유, 양도, 대여는 금지됩니다.',
            '침해가 의심될 경우 즉시 비밀번호를 변경하고 회사에 통지해야 합니다.',
          ],
        ),
        _ServiceSection(
          title: '제6조(이용자의 의무)',
          bullets: <String>[
            '법령 및 본 약관, 공지사항을 준수해야 합니다.',
            '타인의 권리를 침해하는 콘텐츠를 게시·전송·배포해서는 안 됩니다.',
            '자동화 수단을 통한 무단 수집·스크래핑·크롤링은 금지됩니다.',
            '서비스의 정상적인 운영을 방해하는 행위는 금지됩니다.',
          ],
        ),
        _ServiceSection(
          title: '제7조(유료서비스 및 결제)',
          bullets: <String>[
            '유료서비스의 가격, 제공 내용, 이용 조건은 서비스 내 고지된 정책을 따릅니다.',
            '정기 결제의 경우 약정된 주기에 따라 자동으로 결제가 이루어집니다.',
            '결제 수단은 신용/체크카드, 간편결제 등 회사가 정한 방식으로 할 수 있습니다.',
            '부정 결제 탐지 시 즉시 이용을 제한할 수 있습니다.',
          ],
        ),
        _ServiceSection(
          title: '제8조(구독, 갱신, 해지 및 환불)',
          bullets: <String>[
            '구독은 결제일을 기점으로 동일 주기로 갱신됩니다.',
            '해지는 다음 결제 예정일 이전에 진행해야 하며, 해지 시 잔여 기간은 만료일까지 유지됩니다.',
            '법령 및 소비자분쟁해결기준이 정하는 범위 내에서 환불이 가능합니다.',
            '이미 제공된 서비스 또는 사용된 크레딧은 환불 대상에서 제외될 수 있습니다.',
          ],
        ),
        _ServiceSection(
          title: '제9조(콘텐츠의 권리와 책임)',
          bullets: <String>[
            '회원이 업로드한 콘텐츠의 저작권은 원칙적으로 회원에게 귀속합니다.',
            '회사는 서비스 운영, 홍보를 위해 필요한 범위에서 해당 콘텐츠를 사용할 수 있습니다.',
            '타인의 권리를 침해하는 콘텐츠로 인해 발생하는 분쟁과 책임은 게시자에게 있습니다.',
          ],
        ),
        _ServiceSection(
          title: '제10조(개인정보의 보호)',
          paragraphs: <String>[
            '회사는 개인정보보호법 등 관련 법령에 따라 회원의 개인정보를 보호하며, 구체적인 사항은 개인정보처리방침을 따릅니다.',
          ],
        ),
        _ServiceSection(
          title: '제11조(서비스 이용 제한)',
          paragraphs: <String>[
            '회사는 다음 각 호에 해당하는 경우 사전 통지 없이 서비스 이용을 제한하거나 계정을 해지할 수 있습니다.',
          ],
          bullets: <String>[
            '약관 또는 법령을 위반하는 경우',
            '타인의 권리 침해, 사칭, 불법 행위가 확인된 경우',
            '시스템에 과도한 부하를 초래하거나 보안 위협이 되는 행위를 하는 경우',
          ],
        ),
        _ServiceSection(
          title: '제12조(면책조항)',
          bullets: <String>[
            '천재지변, 정전, IDC 장애 등 불가항력으로 인한 손해에 대해서는 책임을 지지 않습니다.',
            '회원의 귀책 사유로 발생한 손해에 대해서는 책임을 지지 않습니다.',
            '베타/실험적 기능의 정확성, 적합성, 가용성은 보장되지 않습니다.',
          ],
        ),
        _ServiceSection(
          title: '제13조(손해배상)',
          paragraphs: <String>[
            '회사의 책임 있는 사유로 회원에게 손해가 발생한 경우, 회사는 관련 법령이 허용하는 범위 내에서 실제로 입은 통상손해를 배상합니다. 다만, 회사는 간접 손해, 특별 손해, 결과적 손해에 대해서는 책임을 지지 않습니다.',
          ],
        ),
        _ServiceSection(
          title: '제14조(분쟁해결 및 관할)',
          paragraphs: <String>[
            '회사와 회원 간 분쟁이 발생할 경우, 상호 협의로 원만히 해결함을 원칙으로 합니다. 협의가 이루어지지 않을 경우 관할 법원은 회사의 본점 소재지를 관할하는 법원으로 합니다.',
          ],
        ),
        _ServiceSection(
          title: '제15조(고지 및 통지)',
          paragraphs: <String>[
            '회사는 서비스 내 공지사항 게시, 이메일, 알림 등을 통해 회원에게 중요한 사항을 통지할 수 있습니다. 회원은 연락처 정보가 항상 최신 상태인지 확인해야 합니다.',
          ],
        ),
        _ServiceSection(
          title: '부칙',
          paragraphs: <String>[
            '본 약관은 2025년 1월 1일부터 적용됩니다. 회사는 필요한 경우 약관을 개정할 수 있으며, 개정 사항은 사전에 공지합니다.',
          ],
        ),
      ],
      effectiveDate: '적용일: 2025년 1월 1일',
    ),
    _ServiceDocument(
      title: '개인정보 처리방침',
      description: '개인정보 수집·이용 및 보호 정책을 안내드립니다.',
      icon: Icons.privacy_tip_rounded,
      introParagraphs: <String>[
        '주식회사 온마인즈(이하 "회사")는 이용자의 개인정보를 소중히 여기며, 개인정보보호법 등 관계 법령을 준수합니다. 본 방침은 부엉 스피치 서비스와 관련하여 개인정보의 수집·이용·보관·제공 기준을 설명합니다.',
      ],
      sections: <_ServiceSection>[
        _ServiceSection(
          title: '1. 수집하는 개인정보의 항목',
          bullets: <String>[
            '필수항목: 이메일, 비밀번호(해시), 이름/닉네임, 서비스 이용기록, 결제/구독 정보',
            '선택항목: 프로필 이미지, 연락처, 직무/관심사',
            '자동수집: IP 주소, 기기/브라우저 정보, 접속 일시, 쿠키, 로그 데이터',
          ],
        ),
        _ServiceSection(
          title: '2. 개인정보의 수집 방법',
          bullets: <String>[
            '회원 가입 및 서비스 이용 과정에서 이용자가 직접 입력',
            'API 연동, 결제 모듈, 고객센터 상담 등 서비스 제공 과정에서 생성·수집',
            '쿠키 및 유사 기술을 통한 자동 수집',
          ],
        ),
        _ServiceSection(
          title: '3. 개인정보의 이용 목적',
          bullets: <String>[
            '회원 식별, 서비스 제공 및 운영, 고객지원',
            '결제/과금, 사용량 관리, 구독 갱신 및 청구',
            '보안, 부정사용 방지, 서비스 개선 및 통계 분석',
            '공지사항 전달, 이벤트/혜택 안내(수신 동의 시)',
          ],
        ),
        _ServiceSection(
          title: '4. 보유 및 이용 기간',
          paragraphs: <String>[
            '원칙적으로 개인정보의 처리 목적이 달성되면 지체 없이 파기합니다. 단, 다음의 경우 법령에 따라 일정 기간 보관할 수 있습니다.',
          ],
          bullets: <String>[
            '계약 또는 청약 철회 등에 관한 기록: 5년',
            '대금 결제 및 재화 등의 공급에 관한 기록: 5년',
            '소비자 불만 또는 분쟁 처리에 관한 기록: 3년',
            '로그인 기록(접속기록): 1년',
          ],
        ),
        _ServiceSection(
          title: '5. 개인정보의 제3자 제공',
          paragraphs: <String>[
            '회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 법령에 근거하거나 이용자의 동의가 있는 경우에 한하여 제공할 수 있습니다.',
          ],
        ),
        _ServiceSection(
          title: '6. 개인정보 처리의 위탁',
          paragraphs: <String>[
            '원활한 서비스 제공을 위해 일부 업무를 외부 전문 업체에 위탁할 수 있으며, 위탁 시 개인정보보호 관련 법령에 따라 안전하게 관리되도록 합니다.',
          ],
          bullets: <String>[
            '인증/로그인: Google, Kakao (OAuth)',
            '결제 처리: 토스페이먼츠, Bootpay',
            '클라우드/호스팅: Vercel 등',
          ],
        ),
        _ServiceSection(
          title: '7. 국외 이전',
          paragraphs: <String>[
            '일부 서비스(예: Vercel, OpenAI 등)의 서버가 해외에 위치할 수 있으며, 이에 따라 필요한 범위 내에서 개인정보가 국외로 이전될 수 있습니다. 회사는 법령이 요구하는 절차에 따라 적절한 보호조치를 시행합니다.',
          ],
        ),
        _ServiceSection(
          title: '8. 정보주체의 권리',
          bullets: <String>[
            '이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지를 요구할 수 있습니다.',
            '회원 탈퇴 시 지체 없이 개인정보를 파기하며, 관련 법령에 따른 의무 보관 정보는 예외로 합니다.',
            '권리 행사는 고객센터 또는 이메일(company@onminds.net)을 통해 요청하실 수 있습니다.',
          ],
        ),
        _ServiceSection(
          title: '9. 개인정보의 안전성 확보조치',
          bullets: <String>[
            '개인정보의 암호화 저장, 전송 구간 암호화(HTTPS)',
            '접근 통제 및 권한 관리, 2단계 인증(적용 시)',
            '보안 취약점 점검, 로그 모니터링',
          ],
        ),
        _ServiceSection(
          title: '10. 쿠키의 사용',
          paragraphs: <String>[
            '회사는 이용자의 편의와 맞춤형 서비스 제공을 위해 쿠키를 사용할 수 있습니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다.',
          ],
        ),
        _ServiceSection(
          title: '11. 청소년 보호',
          paragraphs: <String>[
            '만 14세 미만 아동은 법정대리인의 동의가 있어야 회원가입이 가능합니다. 회사는 법정대리인의 동의 없이 수집된 것으로 확인된 개인정보에 대해서는 지체 없이 삭제합니다.',
          ],
        ),
        _ServiceSection(
          title: '12. 고지 및 문의',
          bullets: <String>[
            '개인정보 관련 문의: company@onminds.net',
            '주소: 수원시 통달구 갓매산로 51, 6층',
            '시행일: 2025-01-01',
          ],
        ),
      ],
      effectiveDate: '시행일: 2025년 1월 1일',
    ),
    _ServiceDocument(
      title: '커뮤니티 가이드',
      description: '안전한 커뮤니티 이용을 위한 원칙과 제재 절차를 안내합니다.',
      icon: Icons.groups_rounded,
      introParagraphs: <String>[
        '부엉 스피치 커뮤니티는 모두가 안전하게 질문·공유·협업할 수 있는 공간을 지향합니다. 아래 원칙을 지켜 주세요.',
      ],
      sections: <_ServiceSection>[
        _ServiceSection(
          title: '1. 기본 원칙',
          bullets: <String>[
            '존중: 차별, 혐오, 괴롭힘, 개인 공격 금지.',
            '정확성: 허위 정보, 오해를 부르는 게시물 지양.',
            '저작권/초상권 준수: 무단 복제·배포·인용 금지.',
            '프라이버시 보호: 본인/타인의 민감·식별정보 게시 금지.',
          ],
        ),
        _ServiceSection(
          title: '2. 금지 콘텐츠',
          bullets: <String>[
            '불법 행위, 범죄 모의, 해킹/크랙, 불법 다운로드·도박·사행성 유도.',
            '폭력·자해·테러 선동, 혐오·차별 발언, 성적/음란물, 그루밍.',
            '스팸/도배, 광고 도배, 악성 링크/피싱, 과도한 자동 수집.',
            '타인 사칭, 허위 이력·자격, 악의적 평판 훼손.',
            '저작권/상표권/초상권 등 타인 권리 침해.',
          ],
        ),
        _ServiceSection(
          title: '3. 신고 · 차단 · 삭제',
          bullets: <String>[
            '모든 메시지/이미지/파일에 신고 버튼을 제공합니다.',
            '부적절한 사용자를 차단하거나, 내 게시물·댓글을 삭제할 수 있습니다.',
            '신고·차단 접수 후 모더레이터가 검토하고 필요 시 추가 제재를 진행합니다.',
          ],
        ),
        _ServiceSection(
          title: '4. 모더레이션(자동 + 수동)',
          bullets: <String>[
            '자동: 금지어/혐오어 필터, 스팸/도배 감지, 이미지·링크 안전성 검사.',
            '수동: 신고 건 및 이상 징후를 전담 모더레이터가 검토.',
            '필요 시 콘텐츠 숨김/삭제, 경고, 일정 기간 제한, 계정 정지·해지 적용.',
          ],
        ),
        _ServiceSection(
          title: '5. 제재 단계',
          bullets: <String>[
            '1차: 경고 및 문제 콘텐츠 삭제·비공개.',
            '2차: 일정 기간 이용 제한, 재발 시 계정 정지.',
            '3차: 반복·중대한 위반은 즉시 영구 정지 가능.',
          ],
        ),
        _ServiceSection(
          title: '6. 이의제기 / 문의',
          bullets: <String>[
            '제재나 신고 처리에 대한 이의제기/문의는 “내 정보 > 문의하기”에서 접수할 수 있습니다.',
            '가능한 한 신속히 검토해 결과를 안내합니다.',
          ],
        ),
        _ServiceSection(
          title: '7. 추가 참고',
          bullets: <String>[
            'AI 생성물은 오류가 있을 수 있습니다. 사실 검증 후 활용해 주세요.',
            '서비스 이용약관 및 개인정보처리방침도 함께 적용됩니다.',
          ],
        ),
      ],
      effectiveDate: '시행일: 2025년 1월 1일',
    ),
    _ServiceDocument(
      title: '환불 규정',
      description: '환불 요청 절차와 기준을 확인하실 수 있습니다.',
      icon: Icons.receipt_long_rounded,
      introParagraphs: <String>[
        '본 환불 규정은 전자상거래 등에서의 소비자보호에 관한 법률, 콘텐츠산업진흥법, 전자금융거래법, 소비자분쟁해결기준 등 관련 법령을 준수합니다.',
      ],
      sections: <_ServiceSection>[
        _ServiceSection(
          title: '1. 적용 대상',
          paragraphs: <String>[
            '부엉 스피치 서비스에서 제공되는 정기 구독형 유료서비스, 크레딧/사용권 등 디지털 콘텐츠 유료 결제에 적용됩니다.',
          ],
        ),
        _ServiceSection(
          title: '2. 청약철회(결제 취소)',
          bullets: <String>[
            '결제일로부터 7일 이내, 미사용 시 전액 환불 가능합니다. (전자상거래법 제17조)',
            '서비스 또는 크레딧을 사용한 경우, 사용분을 제외하고 환불하거나 환불이 제한될 수 있습니다.',
            '디지털 콘텐츠가 즉시 제공되어 실사용이 개시된 경우, 전자상거래법 시행령 제21조 제2항에 따라 청약철회가 제한될 수 있습니다.',
          ],
        ),
        _ServiceSection(
          title: '3. 정기 구독(자동결제) 환불',
          bullets: <String>[
            '구독은 결제 주기 시작과 동시에 효력이 발생하며, 구독 중도 해지 시 다음 결제일부터 갱신이 중단됩니다.',
            '이미 개시된 구독 기간은 원칙적으로 환불되지 않으나, 서비스 장애 등 귀책 사유가 있는 경우 소비자분쟁해결기준에 따릅니다.',
            '갱신 전 해지: 다음 결제일부터 자동 갱신 중단',
          ],
        ),
        _ServiceSection(
          title: '4. 서비스 장애/하자에 따른 환불',
          bullets: <String>[
            '연속 4시간 이상, 또는 월 누적 24시간 이상 서비스 장애 발생 시 미사용 기간을 연장하거나 해당 기간 요금을 비례 환불합니다. (소비자분쟁해결기준)',
            '결함·하자 있는 콘텐츠 제공 시 지체 없이 재제공 또는 환불합니다. (콘텐츠산업진흥법)',
          ],
        ),
        _ServiceSection(
          title: '5. 환불 방법 및 기한',
          bullets: <String>[
            '환불 승인일로부터 3영업일 이내 결제 수단으로 환급 처리합니다. (카드사 사정에 따라 3~7영업일 지연 가능)',
            '부분 환불의 경우 사용 금액·기간·제공된 혜택을 고려하여 산정합니다.',
          ],
        ),
        _ServiceSection(
          title: '6. 환불이 제한되는 경우',
          bullets: <String>[
            '구독/크레딧을 실사용하여 복제가 가능하거나 가치가 현저히 감소한 경우',
            '이벤트/프로모션 등으로 무상 제공된 혜택만 사용한 경우',
            '법령상 청약철회가 제한되는 디지털 콘텐츠에 해당하는 경우',
          ],
        ),
        _ServiceSection(
          title: '7. 부정 결제 및 오결제',
          bullets: <String>[
            '명의 도용, 도난 카드 등 위법한 결제로 확인되면 전액 환불 및 결제 취소를 지원합니다. (전자금융거래법)',
            '오결제 확인 시 신속히 취소/환불을 진행합니다.',
          ],
        ),
        _ServiceSection(
          title: '8. 환불 접수 및 문의',
          bullets: <String>[
            '고객센터 이메일: company@onminds.net',
            '전화: (비공개)',
            '주소: 수원시 통달구 갓매산로 51, 6층',
          ],
        ),
        _ServiceSection(
          title: '9. 부칙',
          paragraphs: <String>[
            '본 환불 규정은 2025년 1월 1일부터 적용됩니다. 회사는 관련 법령 및 내부 정책 변화에 따라 본 규정을 개정할 수 있으며, 개정 시 사전에 공지합니다.',
          ],
        ),
      ],
      effectiveDate: '적용일: 2025년 1월 1일',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('서비스 정보'),
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      backgroundColor: const Color(0xFFF4F6FB),
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
        itemCount: _documents.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (BuildContext context, int index) {
          final _ServiceDocument doc = _documents[index];
          return _ServiceCard(document: doc);
        },
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.document});

  final _ServiceDocument document;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => _ServiceDocumentPage(document: document),
            ),
          );
        },
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: const [
              BoxShadow(
                color: Color(0x12000000),
                blurRadius: 18,
                offset: Offset(0, 12),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF2FB),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(document.icon, color: const Color(0xFF4C51BF)),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      document.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      document.description,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF6B7280),
                        height: 1.36,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.black38),
            ],
          ),
        ),
      ),
    );
  }
}

class _ServiceDocumentPage extends StatelessWidget {
  const _ServiceDocumentPage({required this.document});

  final _ServiceDocument document;

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(document.title),
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      backgroundColor: const Color(0xFFF4F6FB),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x12000000),
                    blurRadius: 18,
                    offset: Offset(0, 12),
                  ),
                ],
              ),
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final String paragraph in document.introParagraphs)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Text(
                        paragraph,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF4B5563),
                          height: 1.6,
                        ),
                      ),
                    ),
                  for (final _ServiceSection section in document.sections)
                    _SectionBlock(section: section),
                  if (document.effectiveDate != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      document.effectiveDate!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF6B7280),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionBlock extends StatelessWidget {
  const _SectionBlock({required this.section});

  final _ServiceSection section;

  @override
  Widget build(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            section.title,
            style: textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: const Color(0xFF1F2937),
            ),
          ),
          const SizedBox(height: 8),
          for (final String paragraph in section.paragraphs)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                paragraph,
                style: textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFF4B5563),
                  height: 1.6,
                ),
              ),
            ),
          if (section.bullets.isNotEmpty)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children:
                  section.bullets
                      .map(
                        (String bullet) => Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Padding(
                                padding: EdgeInsets.only(top: 6, right: 8),
                                child: Icon(
                                  Icons.circle,
                                  size: 6,
                                  color: Color(0xFF9CA3AF),
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  bullet,
                                  style: textTheme.bodyMedium?.copyWith(
                                    color: const Color(0xFF4B5563),
                                    height: 1.6,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                      .toList(),
            ),
        ],
      ),
    );
  }
}

class _ServiceDocument {
  const _ServiceDocument({
    required this.title,
    required this.description,
    required this.icon,
    required this.introParagraphs,
    required this.sections,
    this.effectiveDate,
  });

  final String title;
  final String description;
  final IconData icon;
  final List<String> introParagraphs;
  final List<_ServiceSection> sections;
  final String? effectiveDate;
}

class _ServiceSection {
  const _ServiceSection({
    required this.title,
    this.paragraphs = const <String>[],
    this.bullets = const <String>[],
  });

  final String title;
  final List<String> paragraphs;
  final List<String> bullets;
}
