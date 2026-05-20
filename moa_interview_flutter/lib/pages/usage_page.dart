import 'package:flutter/material.dart';

class UsagePage extends StatelessWidget {
  const UsagePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFDFBF7),
        elevation: 0,
        title: const Text(
          '이용 방법',
          style: TextStyle(
            color: Color(0xFF4E342E),
            fontWeight: FontWeight.w900,
            fontSize: 20,
            letterSpacing: -0.5,
          ),
        ),
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF4E342E)),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '부엉 스피치 100% 활용하기',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF4E342E),
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'AI 면접관과 함께 언제 어디서든 실전처럼 말하기 연습을 해보세요. 아래 안내를 따라 차근차근 시작해 보세요!',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF8D6E63),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              
              _StepCard(
                index: 1,
                title: '홈에서 목표와 프로필을 정해요',
                body: '지원 회사, 직무, 주요 경험 카드를 눌러 면접 정보를 설정하세요. 입력된 정보를 바탕으로 AI가 맞춤형 꼬리 질문을 생성합니다.',
                mockupBuilder: () => _MockHomeCards(),
              ),
              const SizedBox(height: 24),
              
              _StepCard(
                index: 2,
                title: '면접 질문 연습을 시작해요',
                body: '상단 배너나 하단 버튼을 눌러 연습 모드로 진입합니다. 자기소개를 입력하고, 텍스트나 음성으로 자유롭게 답변해보세요.',
                mockupBuilder: () => _MockInterviewStart(),
              ),
              const SizedBox(height: 24),
              
              _StepCard(
                index: 3,
                title: '답변 · 음성 피드백을 확인해요',
                body: '연습이 끝나면 5가지 핵심 기준(내용, 억양, 속도 등)에 따른 AI의 상세한 평가와 개선 포인트를 바로 확인할 수 있습니다.',
                mockupBuilder: () => _MockFeedback(),
              ),
              const SizedBox(height: 24),
              
              _StepCard(
                index: 4,
                title: '기록 · 점수 탭을 활용해요',
                body: '지난 연습 세션들을 기록 탭에서 모아보고, 내 점수 탭에서 면접 실력이 얼마나 향상되고 있는지 전체 통계를 확인하세요.',
                mockupBuilder: () => _MockRecords(),
              ),
              const SizedBox(height: 24),
              
              _StepCard(
                index: 5,
                title: '마이페이지 설정',
                body: '프로필 사진이나 계정 정보를 마이페이지에서 관리할 수 있습니다. 문의사항이 생기면 언제든 문의하기를 이용해 주세요.',
                mockupBuilder: () => _MockProfile(),
              ),
              
              const SizedBox(height: 32),
              _buildTipBanner(),
              const SizedBox(height: 48),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTipBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD54F).withValues(alpha: 0.15),
            blurRadius: 15,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.tips_and_updates_rounded, color: Color(0xFFF57F17), size: 26),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  '부엉 스피치 꿀팁!',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                    color: Color(0xFF4E342E),
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  '조용한 환경에서 마이크 권한을 허용한 뒤 직접 소리내어 답변하면 AI가 음성 높낮이와 말투, 속도까지 완벽하게 분석해 줄 수 있어요.',
                  style: TextStyle(
                    color: Color(0xFF8D6E63),
                    height: 1.5,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepCard extends StatelessWidget {
  final int index;
  final String title;
  final String body;
  final Widget Function() mockupBuilder;

  const _StepCard({
    required this.index,
    required this.title,
    required this.body,
    required this.mockupBuilder,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFEFEBE9), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF8D6E63).withValues(alpha: 0.05),
            blurRadius: 15,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Visual Mockup Area
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: Color(0xFFFAFAFA),
              borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
            ),
            child: mockupBuilder(),
          ),
          
          // Divider
          Container(height: 1.5, color: const Color(0xFFEFEBE9)),
          
          // Text Area
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFF8D6E63),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$index',
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF4E342E),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  body,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF8D6E63),
                    height: 1.6,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ----------------------------------------------------------------------
// Mini UI Mockups
// ----------------------------------------------------------------------

class _MockHomeCards extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        children: [
          _miniActionCard(Icons.business_rounded, '지원 회사 입력', '아직 입력되지 않았어요'),
          const SizedBox(height: 8),
          _miniActionCard(Icons.work_rounded, '지원 직무 입력', '어떤 직무를 준비하시나요?'),
        ],
      ),
    );
  }

  Widget _miniActionCard(IconData icon, String title, String subtitle) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFDFBF7),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEFEBE9)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: const Color(0xFFEFEBE9))),
            child: Icon(icon, size: 16, color: const Color(0xFF8D6E63)),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF4E342E))),
              const SizedBox(height: 4),
              Text(subtitle, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ),
        ],
      ),
    );
  }
}

class _MockInterviewStart extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFFFF8E1), Color(0xFFFFECB3)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 26,
            backgroundColor: Color(0xFF8D6E63),
            backgroundImage: AssetImage('assets/images/profile_owl_1.png'),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('AI 면접관과 스피킹', style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF4E342E), fontSize: 16)),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(color: const Color(0xFF4E342E), borderRadius: BorderRadius.circular(16)),
                  child: const Text('시작하기', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w900)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MockFeedback extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
             Row(
               children: [
                 const Icon(Icons.analytics_rounded, size: 18, color: Color(0xFF8D6E63)),
                 const SizedBox(width: 6),
                 const Text('답변 상세 분석', style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF4E342E), fontSize: 14)),
               ],
             ),
             Container(
               padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
               decoration: BoxDecoration(color: const Color(0xFFE8F5E9), borderRadius: BorderRadius.circular(12)),
               child: const Text('최고 92점', style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF2E7D32), fontSize: 12)),
             ),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFEFEBE9)),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 4, offset: const Offset(0, 2))],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.lightbulb_rounded, color: Color(0xFFFFCA28), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                     Text('AI 코멘트', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF4E342E))),
                     SizedBox(height: 6),
                     Text('지원 동기가 명확합니다! 관련된 경험을 덧붙인다면 훨씬 더 설득력 있는 답변이 될 거예요.', style: TextStyle(fontSize: 12, color: Color(0xFF8D6E63), height: 1.5, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MockRecords extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _miniRecordItem('어제 오후 2:30', '프론트엔드 개발자', '90점', const Color(0xFF4CAF50)),
        const SizedBox(height: 10),
        _miniRecordItem('3월 25일', '백엔드 엔지니어', '82점', const Color(0xFF2196F3)),
      ],
    );
  }

  Widget _miniRecordItem(String date, String role, String score, Color scoreColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEFEBE9)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(role, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF4E342E))),
              const SizedBox(height: 4),
              Text(date, style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600)),
            ],
          ),
          Text(score, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: scoreColor)),
        ],
      ),
    );
  }
}

class _MockProfile extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFEFEBE9)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFFFCA28), width: 2),
            ),
            child: const CircleAvatar(
              radius: 24,
              backgroundColor: Color(0xFFFDFBF7),
              backgroundImage: AssetImage('assets/images/profile_owl_5.png'),
            ),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: const [
              Text('오명훈님!', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF4E342E))),
              SizedBox(height: 6),
              Text('사용자 설정 및 문의 관리해 보세요.', style: TextStyle(fontSize: 12, color: Color(0xFF8D6E63), fontWeight: FontWeight.w500)),
            ],
          ),
        ],
      ),
    );
  }
}
