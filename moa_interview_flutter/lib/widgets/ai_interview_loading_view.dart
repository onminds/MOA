import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

class AiInterviewLoadingView extends StatefulWidget {
  const AiInterviewLoadingView({super.key});

  @override
  State<AiInterviewLoadingView> createState() => _AiInterviewLoadingViewState();
}

class _AiInterviewLoadingViewState extends State<AiInterviewLoadingView>
    with TickerProviderStateMixin {
  /// 한글은 자동 줄바꿈 시 음절 단위로 끊겨 '미/소' 등이 어색해질 수 있어, 어절/절 단위 \n로 고정.
  final List<String> _tips = [
    '면접관의 질문 의도가 무엇인지\n먼저 파악하세요.\n\n답변의 방향을 잡는 것이\n무엇보다 중요해요 💡',
    '면접이 끝날 때 "마지막으로 하고 싶은 말"을\n미리 1분 내외로 정리해 두면\n큰 도움이 됩니다 📝',
    '자신의 경험은\nSTAR(상황/과제/행동/결과) 기법\u2060으로\n구조화해서 답변하면\n훨씬 논리적으로 들려요 ⭐',
    '항상 두괄식으로 핵심 결론부터\n먼저 명확히 말하고,\n그 뒤에 구체적인 이유와 사례를\n덧붙여 보세요 🗣️',
    '예상치 못한 질문에는 당황하지 마세요.\n"잠시 생각할 시간을 주시겠습니까?"라고\n정중히 요청하세요 ⏱️',
    'AI가 회원님이 입력하신 프로필과 직무를 분석해\n실전에서 나올 법한 날카로운\n예상 질문을 만들고 있어요 🦉',
    '떨리더라도 자신감 있는 목소리와\n부드러운 미소를 띠어보세요.\n\n긍정적인 에너지는 면접관에게\n훌륭하게 전달됩니다 ✨',
    '답변할 때 허공을 보거나\n시선을 피하지 말고,\n면접관과 부드러운 눈맞춤\n(Eye Contact)을 유지하세요 👀',
    '단점을 묻는 질문에는 치명적인 단점 대신,\n이를 극복하기 위해 노력 중인\n구체적인 과정을 말해보세요 🌱',
    '모의고사라고 생각하지 말고\n끄덕임과 적절한 제스처로\n실제 면접에 임하듯 생생하고\n진지하게 연습해 보세요 🎬',
    '직무와 무관해 보이는 상황 질문도\n회사의 인재상을 확인하려는 목적이에요.\n\n회사의 핵심 가치와 연관 지어\n답변해 보세요 🤝',
  ];

  int _currentTipIndex = 0;
  Timer? _timer;
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;
  late AnimationController _progressController;
  late Animation<double> _progressAnimation;

  @override
  void initState() {
    super.initState();
    _tips.shuffle(); // 랜덤한 팁 순서

    // 프로그레스 바 애니메이션 설정 (1분 30초 동안 0 -> 99%)
    _progressController = AnimationController(
       vsync: this,
       duration: const Duration(seconds: 90),
    );
    _progressAnimation = Tween<double>(begin: 0.0, end: 0.99).animate(
      CurvedAnimation(parent: _progressController, curve: Curves.easeOutQuart),
    );
    _progressController.forward();

    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeAnimation = CurvedAnimation(parent: _fadeController, curve: Curves.easeInOut);

    _fadeController.forward();

    // 4초마다 팁 변경
    _timer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (!mounted) return;
      _fadeController.reverse().then((_) {
        if (!mounted) return;
        setState(() {
          _currentTipIndex = (_currentTipIndex + 1) % _tips.length;
        });
        _fadeController.forward();
      });
    });
  }

  @override
  void dispose() {
    _progressController.dispose();
    _timer?.cancel();
    _fadeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFFFDFBF7),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(flex: 2),

          // 부엉이 로티 애니메이션 및 후광 효과
          Stack(
            alignment: Alignment.center,
            children: [
              // 뒤쪽의 은은한 후광(Glow) 효과
              Container(
                width: 250,
                height: 250,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFFFFD54F).withValues(alpha: 0.35),
                      const Color(0xFFFFE082).withValues(alpha: 0.1),
                      Colors.transparent,
                    ],
                    stops: const [0.2, 0.6, 1.0],
                  ),
                ),
              ),
              // 질문 분석 중인 부엉이 Lottie 파일 -> PNG 5장 프레임 애니메이션으로 교체
              const _NewOwlLoadingAnimation(),
            ],
          ),

          const SizedBox(height: 20),

          // 메인 로딩 텍스트
          const Text(
            '면접 질문을 준비하고 있어요',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              color: Color(0xFF4E342E),
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 12),

          // 서브 설명 텍스트
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              '입력하신 직무와 분석 정보를 바탕으로\n가장 출제 확률이 높은 질문을 선별 중입니다.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: const Color(0xFF8D6E63),
                height: 1.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),

          const SizedBox(height: 32),

          // 진척도 로딩 바 (1분 30초 동안 99%까지)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 48),
            child: AnimatedBuilder(
              animation: _progressAnimation,
              builder: (context, child) {
                final percent = (_progressAnimation.value * 100).toInt();
                return Column(
                  children: [
                    Container(
                      height: 10,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF3E0),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(5),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: FractionallySizedBox(
                            widthFactor: _progressAnimation.value,
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFFFFB300), Color(0xFFFF8F00)],
                                ),
                                borderRadius: BorderRadius.circular(5),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '$percent%',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFE65100),
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    )
                  ],
                );
              },
            ),
          ),

          const SizedBox(height: 24),

          // 팁 카드 UI (글래스모피즘 & 카드형)
          SizedBox(
            height: 230,
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFFFFF8E1), width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF8D6E63).withValues(alpha: 0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.lightbulb_circle_rounded,
                        color: Color(0xFFFFB300),
                        size: 22,
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        '기다리는 동안 읽어보세요',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFEF6C00),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  
                  // 애니메이션 팁 텍스트
                  FadeTransition(
                    opacity: _fadeAnimation,
                    child: Text(
                      _tips[_currentTipIndex],
                      textAlign: TextAlign.center,
                      locale: const Locale('ko', 'KR'),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF5D4037),
                        height: 1.45,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),

          const Spacer(flex: 3),
        ],
      ),
    );
  }
}

class _NewOwlLoadingAnimation extends StatefulWidget {
  const _NewOwlLoadingAnimation();

  @override
  State<_NewOwlLoadingAnimation> createState() => _NewOwlLoadingAnimationState();
}

class _NewOwlLoadingAnimationState extends State<_NewOwlLoadingAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
       vsync: this,
       duration: const Duration(milliseconds: 4000),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _ctrl.duration = const Duration(milliseconds: 4000); // 핫 리로드 대응용
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        int frame = (_ctrl.value * 5).floor() + 1;
        if (frame > 5) frame = 5;
        return Image.asset(
          'assets/owl_loading/$frame.png',
          width: 280,
          height: 280,
          fit: BoxFit.contain,
          gaplessPlayback: true,
        );
      },
    );
  }
}
