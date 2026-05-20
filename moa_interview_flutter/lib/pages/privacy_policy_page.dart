import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// 웹 [https://www.moa.tools/privacy]와 취지·주요 사항을 맞춥니다. (개정 2026-04-25)
class PrivacyPolicyPage extends StatelessWidget {
  const PrivacyPolicyPage({super.key});

  static const String _openAiPrivacy = 'https://openai.com/policies/privacy-policy';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('개인정보 처리방침', style: TextStyle(color: Color(0xFF3E2723))),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF3E2723)),
      ),
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '개인정보 처리방침',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF3E2723)),
            ),
            const SizedBox(height: 12),
            const Text(
              '주식회사 온마인즈(이하 "회사")는 "개인정보 보호법" 및 관계 법령을 준수합니다. '
              '본 방침은 MOA 서비스(웹) 및 부엉 스피치 앱(면접 AI 연습)을 포함한 서비스에서 '
              '개인정보의 수집·이용·제3자(인공지능 서비스 포함) 제공·국외 이전에 관한 기준을 설명합니다.\n\n'
              '로그인 시 앱에서 별도로 안내하는 「AI 데이터 처리」에 대한 동의는 본 방침과 함께 '
              '제3자 AI로의 전송에 대한 요약 동의로 작동하며, 동의를 거부할 경우 AI 일부 기능 이용이 제한될 수 있습니다.',
              style: TextStyle(fontSize: 14, color: Color(0xFF4B5563), height: 1.6),
            ),
            const SizedBox(height: 20),
            const _SectionTitle('1. 수집하는 개인정보의 항목'),
            const _SectionContent(
              '· 필수·일반: 이메일, 비밀번호(암호화·해시), 이름/닉네임, 서비스 이용·접속 기록, '
              '결제/구독 관련 정보(유료 시)\n'
              '· 면접·AI: 지원 회사명, 직무명, 경력 수준, 직무/경력·경험·스킬, 회사·직무 분석 텍스트, '
              '면접 질문·답변 텍스트, 음성 녹음 파일, 음성-텍스트(전사) 결과 등\n'
              '· 선택: 프로필 이미지, 연락처, 관심 직무, 마케팅(동의 시)\n'
              '· 자동: IP, 기기/앱 식별, 접속 일시, 쿠키, 로그, 푸시 토큰(동의 시) 등',
            ),
            const _SectionTitle('2. 수집 방법'),
            const _SectionContent(
              '회원가입·로그인, 프로필·면접 정보 입력, 면접 연습(텍스트·음성) 등 이용자의 직접 입력, '
              'API·서비스 처리, 결제, 고객센터, 쿠키·SDK(앱)를 통한 자동 수집',
            ),
            const _SectionTitle('3. 이용 목적'),
            const _SectionContent(
              '회원 식별, 서비스 제공(면접 질문·답변·기록), 고객지원\n'
              'AI: 맞춤 질문 생성, 텍스트 답변·음성(전사) 기반 AI 피드백, 음성-텍스트 변환, 품질 개선\n'
              '결제·과금, 부정이용·보안, 공지(동의 시), 법령 이행',
            ),
            const _SectionTitle('4. 보유·이용 기간'),
            const _SectionContent(
              '목적 달성 후 지체 없이 파기. 다만 전자상거래 등에서의 소비자보호, 세법 등 관계 법령에 따라 '
              '계약·결제·분쟁·접속기록 등은 각 법령이 정한 기간 보관될 수 있습니다. '
              '제3자(AI) 처리분은 해당 수탁자의 정책·계약이 적용됩니다.',
            ),
            const _SectionTitle('5. 제3자 제공'),
            const _SectionContent(
              '원칙적으로 제3자에게 판매·대여하지 않습니다. 법령, 이용자 동의(로그인·기능 사용 시), '
              '또는 아래 수탁·AI 연동(6·7절)에 따릅니다.',
            ),
            const _SectionTitle('6. 제3자 AI(OpenAI) 및 국외 이전'),
            const _SectionContent(
              '면접 AI(질문 생성, 답변·음성 분석, 음성-텍스트 변환)는 회사 서버를 통해 OpenAI, LLC(미국) API로 '
              '처리될 수 있으며, 직무·경력·질문·답변·음성/전사 등이 HTTPS 등으로 전송(국외 이전 포함)될 수 있습니다. '
              'OpenAI 측 처리는 OpenAI Privacy Policy를 따릅니다. 실제 API 구현에 따라 항목은 달라질 수 있으나, '
              '로그인 동의 화면의 설명·본 절·웹 개인정보처리방침은 동일 취지로 유지됩니다. '
              'OpenAI 이외 API를 연동하는 경우 앱/공지·본 방침을 고지합니다.',
            ),
            _LinkRow(
              label: 'OpenAI Privacy Policy(웹) →',
              onTap: () => _openUrl(_openAiPrivacy),
            ),
            const _SectionTitle('7. 기타 수탁(위탁)'),
            const _SectionContent(
              '인증: Google, Kakao(OAuth) / 결제: 토스페이먼츠, Bootpay 등 / 호스팅: Vercel, AWS 등 / '
              '푸시·분석(앱): Google Firebase 등 / 광고(해당 시): Google Mobile Ads — 앱·OS·별도 동의에 따릅니다.',
            ),
            const _SectionTitle('8. 국외 이전(일반)'),
            const _SectionContent(
              '6절 OpenAI 외에도 클라우드·호스팅(Vercel, AWS, Firebase 등) 리전에 따라 해외 보관·처리가 있을 수 있으며, '
              '법령이 요구하는 절차와 계약·기술적 보호조치를 이행합니다.',
            ),
            const _SectionTitle('9. 정보주체의 권리'),
            const _SectionContent(
              '열람·정정·삭제·처리정지 요구(법령상 예외 제외), 탈퇴 시 파기(법령상 보관 제외), '
              'AI 전송 동의는 로그인 동의·고객지원을 통해 철회·문의(철회 시 AI 일부 제한)',
            ),
            const _SectionTitle('10. 안전성 확보조치'),
            const _SectionContent(
              '암호화, HTTPS, 접근 통제, 점검, 마이크 권한 등 OS 수준 권한에 대한 앱 내 안내',
            ),
            const _SectionTitle('11. 쿠키'),
            const _SectionContent('웹은 쿠키를 사용할 수 있으며, 브라우저에서 거부·삭제할 수 있습니다.'),
            const _SectionTitle('12. 청소년'),
            const _SectionContent('만 14세 미만은 법정대리인 동의가 필요합니다.'),
            const _SectionTitle('13. 문의'),
            const _SectionContent(
              '개인정보보호·AI 연동: privacy@moa.tools\n'
              '기타: company@onminds.net(문의에 따라 안내)\n'
              '주소: 수원시 통달구 갓매산로 51, 6층\n'
              '시행: 2025-01-01 / 개정: 2026-04-25 (AI·OpenAI·부엉 스피치 항목 반영)',
            ),
            const SizedBox(height: 24),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('웹에서 전문 보기', style: TextStyle(color: Color(0xFF8D6E63), fontWeight: FontWeight.w700)),
              subtitle: const Text('https://www.moa.tools/privacy', style: TextStyle(fontSize: 13)),
              onTap: () => _openUrl('https://www.moa.tools/privacy'),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  static Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: onTap,
        child: Text(
          label,
          style: const TextStyle(
            color: Color(0xFF8D6E63),
            decoration: TextDecoration.underline,
            fontWeight: FontWeight.w700,
            fontSize: 14,
            height: 1.5,
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 16, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: Color(0xFF111827),
        ),
      ),
    );
  }
}

class _SectionContent extends StatelessWidget {
  const _SectionContent(this.content);
  final String content;

  @override
  Widget build(BuildContext context) {
    return Text(
      content,
      style: const TextStyle(fontSize: 14, color: Color(0xFF4B5563), height: 1.6),
    );
  }
}
