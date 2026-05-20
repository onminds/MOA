import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class TermsOfServicePage extends StatelessWidget {
  const TermsOfServicePage({super.key});

  static const String _appleStandardEula =
      'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
  static const String _privacyPolicy = 'https://www.moa.tools/privacy';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('서비스 이용약관'),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                color: Color(0x14000000),
                blurRadius: 24,
                offset: Offset(0, 12),
              ),
            ],
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '부엉 스피치 서비스 이용약관',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF111827),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '최종 업데이트: ${DateTime.now().year}년 ${DateTime.now().month}월 ${DateTime.now().day}일',
                style: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF6B7280),
                ),
              ),
              const SizedBox(height: 24),
              _buildLinksSection(context),
              const SizedBox(height: 32),
              _buildSection(
                '제1조 (목적)',
                '본 약관은 부엉 스피치(이하 "회사")가 제공하는 AI 서비스 및 관련 제반 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.',
              ),
              _buildSection(
                '제2조 (정의)',
                '1. "서비스"란 회사가 제공하는 AI 기반 이미지 생성, 영상 생성, 텍스트 생성, 커뮤니티 등 모든 온라인 서비스를 의미합니다.\n'
                '2. "이용자"란 본 약관에 따라 회사가 제공하는 서비스를 이용하는 회원 및 비회원을 말합니다.\n'
                '3. "회원"이란 회사와 서비스 이용계약을 체결하고 회원 아이디를 부여받은 자를 말합니다.\n'
                '4. "콘텐츠"란 서비스 내에서 회원이 게시하거나 생성한 부호, 문자, 음성, 음향, 그림, 사진, 동영상, 링크 등을 의미합니다.',
              ),
              _buildSection(
                '제3조 (약관의 게시와 개정)',
                '1. 회사는 본 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기 화면 및 앱 내에 게시합니다.\n'
                '2. 회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.\n'
                '3. 회사가 약관을 개정할 경우 적용일자 및 개정사유를 명시하여 현행약관과 함께 서비스 초기 화면에 그 적용일자 7일 이전부터 공지합니다.',
              ),
              _buildSection(
                '제4조 (서비스의 제공 및 변경)',
                '1. 회사는 다음과 같은 서비스를 제공합니다:\n'
                '   • AI 이미지 생성 및 편집\n'
                '   • AI 영상 생성\n'
                '   • AI 텍스트 생성 및 대화\n'
                '   • 커뮤니티 서비스\n'
                '   • 기타 회사가 추가 개발하거나 제휴 계약 등을 통해 제공하는 일체의 서비스\n'
                '2. 회사는 운영상, 기술상의 필요에 따라 제공하고 있는 서비스를 변경할 수 있습니다.',
              ),
              _buildSection(
                '제5조 (이용자 생성 콘텐츠 정책)',
                '1. 이용자는 다음과 같은 콘텐츠를 게시하거나 공유해서는 안 됩니다:\n'
                '   • 타인의 권리를 침해하거나 명예를 훼손하는 내용\n'
                '   • 음란물, 폭력적이거나 혐오스러운 내용\n'
                '   • 불법적이거나 범죄를 조장하는 내용\n'
                '   • 허위 사실이나 사기성 정보\n'
                '   • 스팸, 광고, 홍보성 내용 (회사의 승인 없이)\n'
                '   • 미성년자에게 해로운 내용\n'
                '2. 회사는 부적절한 콘텐츠를 발견하거나 신고받은 경우 사전 통지 없이 해당 콘텐츠를 삭제할 수 있습니다.\n'
                '3. 반복적으로 부적절한 콘텐츠를 게시하는 이용자의 경우 서비스 이용이 제한되거나 계정이 영구 정지될 수 있습니다.',
              ),
              _buildSection(
                '제6조 (신고 및 차단 시스템)',
                '1. 이용자는 부적절한 콘텐츠나 다른 이용자의 부적절한 행동을 회사에 신고할 수 있습니다.\n'
                '2. 이용자는 특정 이용자를 차단하여 해당 이용자의 콘텐츠를 보지 않을 수 있습니다.\n'
                '3. 회사는 신고 접수 시 신속하게 검토하고 적절한 조치를 취합니다.\n'
                '4. 허위 신고나 악의적인 신고를 반복하는 경우 신고자에 대한 제재가 이루어질 수 있습니다.',
              ),
              _buildSection(
                '제7조 (회원탈퇴 및 자격 상실)',
                '1. 회원은 언제든지 서비스 내 설정 메뉴를 통해 이용계약 해지(회원탈퇴)를 요청할 수 있습니다.\n'
                '2. 회원탈퇴 시 회원 정보 및 생성된 콘텐츠는 즉시 삭제되며 복구할 수 없습니다. 단, 관련 법령에 따라 보관이 필요한 정보는 해당 기간 동안 보관됩니다.\n'
                '3. 회사는 다음의 경우 회원자격을 제한 또는 정지시킬 수 있습니다:\n'
                '   • 본 약관을 위반한 경우\n'
                '   • 서비스 운영을 고의로 방해한 경우\n'
                '   • 타인의 권리를 침해한 경우',
              ),
              _buildSection(
                '제8조 (개인정보보호)',
                '회사는 관련 법령이 정하는 바에 따라 이용자의 개인정보를 보호하기 위해 노력합니다. 개인정보의 보호 및 이용에 대해서는 관련 법령 및 회사의 개인정보처리방침이 적용됩니다.',
              ),
              _buildSection(
                '제9조 (면책사항)',
                '1. 회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인해 서비스를 제공할 수 없는 경우 서비스 제공에 대한 책임이 면제됩니다.\n'
                '2. 회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.\n'
                '3. 회사는 이용자가 서비스를 이용하여 기대하는 수익을 얻지 못하거나 상실한 것에 대하여 책임을 지지 않습니다.\n'
                '4. 회사는 이용자가 생성한 콘텐츠의 정확성, 신뢰성 등에 대해 보증하지 않습니다.',
              ),
              _buildSection(
                '제10조 (분쟁해결)',
                '1. 회사와 이용자는 서비스와 관련하여 발생한 분쟁을 원만하게 해결하기 위하여 필요한 노력을 다해야 합니다.\n'
                '2. 제1항의 노력에도 불구하고 분쟁이 해결되지 않을 경우 대한민국 법원을 전속 관할 법원으로 합니다.',
              ),
              const SizedBox(height: 32),
              const Text(
                '본 약관에 동의하지 않으실 경우 서비스 이용이 제한됩니다. 서비스를 계속 이용하시는 것은 본 약관에 동의하는 것으로 간주됩니다.',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF111827),
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSection(String title, String content) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            content,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF374151),
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLinksSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '구독 약관 및 링크',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 12),
        _buildLinkRow(
          context,
          title: 'Apple 표준 이용약관(EULA)',
          url: _appleStandardEula,
        ),
        const SizedBox(height: 8),
        _buildLinkRow(
          context,
          title: '개인정보처리방침',
          url: _privacyPolicy,
        ),
        const SizedBox(height: 8),
        const Text(
          '자동 갱신 구독 시 Apple 표준 EULA가 적용되며, 구독 기간·가격·해지 방법은 앱 내 구독 화면과 App Store 결제 화면에서 확인할 수 있습니다.',
          style: TextStyle(
            fontSize: 13,
            color: Color(0xFF374151),
            height: 1.5,
          ),
        ),
      ],
    );
  }

  Widget _buildLinkRow(BuildContext context,
      {required String title, required String url}) {
    return InkWell(
      onTap: () async {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('링크를 열 수 없습니다.')),
          );
        }
      },
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.link, size: 16, color: Color(0xFF2563EB)),
          const SizedBox(width: 6),
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF2563EB),
              decoration: TextDecoration.underline,
            ),
          ),
        ],
      ),
    );
  }
}

