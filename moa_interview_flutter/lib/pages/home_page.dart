import 'dart:async';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'interview_prep_page.dart';
import 'interview_question_start_page.dart';
import 'my_score_tab_page.dart';
import 'profile_page.dart';
import 'records_tab_page.dart';
import '../config/admob_config.dart';
import '../services/auth_service.dart';
import '../services/interview_prep_setup_cache.dart';
import '../widgets/home_tabs_tutorial_overlay.dart';

/// 홈 탭 하위 [Navigator]에서 프로필 스냅샷 변경 시 목록이 다시 그려지도록 전달합니다.
class HomeSnapshotScope extends InheritedWidget {
  const HomeSnapshotScope({
    super.key,
    required this.snapshot,
    required super.child,
  });

  final InterviewPrepSetupSnapshot? snapshot;

  static HomeSnapshotScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<HomeSnapshotScope>();
  }

  @override
  bool updateShouldNotify(HomeSnapshotScope oldWidget) {
    return snapshot != oldWidget.snapshot;
  }
}

/// 홈 탭 [Navigator] 스택이 루트만이 아닐 때(면접 준비·질문 시작 등) [HomePage]이 하단 탭 표시 여부를 다시 그리도록 함.
class _HomeTabNavigatorObserver extends NavigatorObserver {
  _HomeTabNavigatorObserver({required this.onStackChanged});

  final VoidCallback onStackChanged;

  void _notify() => onStackChanged();

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => _notify();

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => _notify();

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) => _notify();

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) => _notify();
}

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _currentIndex = 0;
  final AuthService _auth = AuthService.instance;
  bool _isLoading = true;
  InterviewPrepSetupSnapshot? _prepSnapshot;

  // 홈 탭 튜토리얼
  int? _homeTabsTutorialStep;
  final GlobalKey _tutorialStackKey = GlobalKey();
  final GlobalKey _recordsTabKey = GlobalKey();
  final GlobalKey _myScoreTabKey = GlobalKey();

  /// 홈 탭만 별도 스택 — 면접 준비/연습 등 푸시 시에는 [NavigatorObserver]로 하단 탭 숨김
  final GlobalKey<NavigatorState> _homeTabNavigatorKey = GlobalKey<NavigatorState>();

  late final NavigatorObserver _homeTabNavigatorObserver = _HomeTabNavigatorObserver(
    onStackChanged: () {
      // didPush/didReplace 등 네비게이터 트랜잭션 도중 동기 setState()는
      // 'child == _child' assertion 실패를 유발할 수 있음 → 프레임 이후에 갱신
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() {});
      });
    },
  );

  /// 기록 탭 상세(답변 요약 등)도 하단 바 유지
  final GlobalKey<NavigatorState> _recordsTabNavigatorKey = GlobalKey<NavigatorState>();

  /// 기록 목록 새로고침([RecordsTabPage.refresh])
  final GlobalKey<RecordsTabPageState> _recordsTabPageKey = GlobalKey<RecordsTabPageState>();

  /// 내점수 탭 새로고침([MyScoreTabPageState.refresh])
  final GlobalKey<MyScoreTabPageState> _myScoreTabPageKey = GlobalKey<MyScoreTabPageState>();

  @override
  void initState() {
    super.initState();
    _loadSetupData();
  }

  Future<void> _loadSetupData() async {
    final snapshot = await InterviewPrepSetupCache.load(_auth.currentUser?.id);
    if (mounted) {
      setState(() {
        _prepSnapshot = snapshot;
        _isLoading = false;
      });
    }
  }

  void _onTabTapped(int index) {
    var poppedNested = false;
    // 홈 탭: 프로필 수정·면접 시작 등이 열려 있으면 저장 없이 닫고, 목록은 캐시(저장된 값) 기준으로 갱신
    if (index == 0) {
      final nav = _homeTabNavigatorKey.currentState;
      if (nav != null && nav.canPop()) {
        nav.popUntil((route) => route.isFirst);
        poppedNested = true;
      }
    }
    // 기록 탭을 떠날 때: 답변 요약·점수 상세 등 중첩 화면을 닫아 두었다가, 다시 오면 항상 기록 목록(첫 화면)
    if (_currentIndex == 1 && index != 1) {
      final recordsNav = _recordsTabNavigatorKey.currentState;
      if (recordsNav != null && recordsNav.canPop()) {
        recordsNav.popUntil((route) => route.isFirst);
      }
    }
    setState(() {
      _currentIndex = index;
    });
    if (poppedNested) {
      _loadSetupData();
    }
    if (index == 1) {
      _recordsTabPageKey.currentState?.refresh();
    }
    if (index == 2) {
      _myScoreTabPageKey.currentState?.refresh();
    }
  }

  Future<void> _navigateToInterviewPrep({
    bool experienceProjectsOnly = false,
    bool initialCompanyJobOnly = false,
    bool startInterviewPractice = false,
  }) async {
    // 홈에서 이미 로드한 스냅샷이 없으면(또는 갱신 전이면) 진입 직전 한 번 더 로드
    final snapshot =
        _prepSnapshot ?? await InterviewPrepSetupCache.load(_auth.currentUser?.id);
    if (!mounted) return;
    final nav = _homeTabNavigatorKey.currentState;
    if (nav == null) return;
    await nav.push<void>(
      MaterialPageRoute<void>(
        builder: (_) => InterviewPrepPage(
          experienceProjectsOnly: experienceProjectsOnly,
          initialCompanyJobOnly: initialCompanyJobOnly,
          startInterviewPractice: startInterviewPractice,
          initialSetupSnapshot: snapshot,
          onFirstCompletion: () {
            if (mounted) setState(() => _homeTabsTutorialStep = 0);
          },
        ),
      ),
    );
    if (mounted) _loadSetupData();
  }

  /// 면접 질문 시작 — AI 생성 / 직접 입력 선택 화면
  Future<void> _navigateToInterviewQuestionStart() async {
    final snapshot =
        _prepSnapshot ?? await InterviewPrepSetupCache.load(_auth.currentUser?.id);
    if (!mounted) return;
    final nav = _homeTabNavigatorKey.currentState;
    if (nav == null) return;
    await nav.push<void>(
      MaterialPageRoute<void>(
        builder: (_) => InterviewQuestionStartPage(
          initialSetupSnapshot: snapshot,
          onFirstCompletion: () {
            if (mounted) setState(() => _homeTabsTutorialStep = 0);
          },
        ),
      ),
    );
    if (mounted) _loadSetupData();
  }

  void _onHomeTabsTutorialTap() {
    if (_homeTabsTutorialStep == null) return;
    final next = _homeTabsTutorialStep! + 1;
    if (next >= kHomeTabsTutorialTotalSteps) {
      setState(() => _homeTabsTutorialStep = null);
    } else {
      setState(() => _homeTabsTutorialStep = next);
    }
  }

  /// 홈 탭에서 면접 연습·로딩·질문 시작 등 하위 라우트가 열려 있을 때만 하단 탭 숨김
  bool get _hideBottomNavForHomeOverlay {
    if (_currentIndex != 0) return false;
    return _homeTabNavigatorKey.currentState?.canPop() ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return HomeSnapshotScope(
      snapshot: _prepSnapshot,
      child: PopScope(
        canPop: false,
        onPopInvokedWithResult: (bool didPop, dynamic result) {
          if (didPop) return;
          if (_currentIndex == 0) {
            final nav = _homeTabNavigatorKey.currentState;
            if (nav != null && nav.canPop()) {
              // pop()은 하위 라우트의 PopScope(canPop: false)를 무시함.
              // maybePop()으로 면접 연습(이전 질문) 등이 먼저 소비되도록 함.
              unawaited(nav.maybePop());
              return;
            }
            // 홈 탭 첫 화면: 뒤로가기로 앱을 종료하지 않음(반복 눌러도 유지)
            return;
          }
          if (_currentIndex == 1) {
            final nav = _recordsTabNavigatorKey.currentState;
            if (nav != null && nav.canPop()) {
              unawaited(nav.maybePop());
              return;
            }
          }
          // 기록·내점수·프로필 등에서 더 pop할 곳이 없을 때: 홈 탭으로(앱 종료 없음)
          var reloaded = false;
          final homeNav = _homeTabNavigatorKey.currentState;
          if (homeNav != null && homeNav.canPop()) {
            homeNav.popUntil((route) => route.isFirst);
            reloaded = true;
          }
          if (_currentIndex == 1) {
            final recordsNav = _recordsTabNavigatorKey.currentState;
            if (recordsNav != null && recordsNav.canPop()) {
              recordsNav.popUntil((route) => route.isFirst);
            }
          }
          final rootNav = Navigator.of(context);
          if (rootNav.canPop()) {
            rootNav.pop();
            return;
          }
          setState(() {
            _currentIndex = 0;
          });
          if (reloaded) {
            unawaited(_loadSetupData());
          }
        },
        child: Stack(
          key: _tutorialStackKey,
          children: [
          Scaffold(
          backgroundColor: const Color(0xFFFDFBF7),
          body: SafeArea(
            child: _buildBody(),
          ),
          bottomNavigationBar:
              _hideBottomNavForHomeOverlay
                  ? null
                  : SafeArea(
                      top: false,
                      maintainBottomViewPadding: true,
                      child: Container(
                        decoration: BoxDecoration(
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 10,
                              offset: const Offset(0, -4),
                            ),
                          ],
                        ),
                        child: BottomNavigationBar(
                          currentIndex: _currentIndex,
                          onTap: _onTabTapped,
                          backgroundColor: Colors.white,
                          selectedItemColor: const Color(0xFF5D4037),
                          unselectedItemColor: const Color(0xFFBCAAA4),
                          showUnselectedLabels: true,
                          type: BottomNavigationBarType.fixed,
                          selectedLabelStyle: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                          unselectedLabelStyle: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                          items: [
                            const BottomNavigationBarItem(
                              icon: Icon(Icons.home_filled, size: 26),
                              label: '홈',
                            ),
                            BottomNavigationBarItem(
                              icon: KeyedSubtree(
                                key: _recordsTabKey,
                                child: const Icon(Icons.receipt_long_rounded, size: 26),
                              ),
                              label: '기록',
                            ),
                            BottomNavigationBarItem(
                              icon: KeyedSubtree(
                                key: _myScoreTabKey,
                                child: const Icon(Icons.insights_rounded, size: 26),
                              ),
                              label: '내점수',
                            ),
                            const BottomNavigationBarItem(
                              icon: Icon(Icons.person_outline_rounded, size: 26),
                              label: '프로필',
                            ),
                          ],
                        ),
                      ),
                    ),
          ),
          // 홈 탭 튜토리얼 오버레이
          if (_homeTabsTutorialStep != null)
            Positioned.fill(
              child: HomeTabsTutorialOverlay(
                stackKey: _tutorialStackKey,
                step: _homeTabsTutorialStep!,
                recordsTabKey: _recordsTabKey,
                myScoreTabKey: _myScoreTabKey,
                onTap: _onHomeTabsTutorialTap,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    return IndexedStack(
      index: _currentIndex,
      sizing: StackFit.expand,
      children: [
        Navigator(
          key: _homeTabNavigatorKey,
          observers: [_homeTabNavigatorObserver],
          initialRoute: '/',
          onGenerateRoute: (RouteSettings settings) {
            if (settings.name == '/') {
              return MaterialPageRoute<void>(
                settings: settings,
                builder: (context) => _buildHomeTab(context),
              );
            }
            return null;
          },
        ),
        Navigator(
          key: _recordsTabNavigatorKey,
          initialRoute: '/',
          onGenerateRoute: (RouteSettings settings) {
            if (settings.name == '/') {
              return MaterialPageRoute<void>(
                settings: settings,
                builder: (_) => RecordsTabPage(key: _recordsTabPageKey),
              );
            }
            return null;
          },
        ),
        MyScoreTabPage(key: _myScoreTabPageKey),
        const ProfilePage(),
      ],
    );
  }

  Widget _buildHomeTab(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF8D6E63)));
    }

    final snap = HomeSnapshotScope.maybeOf(context)?.snapshot ?? _prepSnapshot;
    final companyName = snap?.companyName ?? '';
    final jobTitle = snap?.jobTitle ?? '';

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Top Header (부엉 스피치 텍스트)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: Row(
              children: const [
                Text(
                  '부엉 스피치',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF4E342E),
                    letterSpacing: -1.0,
                  ),
                ),
              ],
            ),
          ),
          
          // 학습하기 카드
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 4.0),
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(24),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: _navigateToInterviewQuestionStart,
                borderRadius: BorderRadius.circular(24),
                child: Ink(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFF8E1), Color(0xFFFFECB3)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFFFD54F)),
                  ),
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Text(
                                    'AI 면접관과 스피킹!\n지금 바로 학습하기',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF5D4037),
                                      height: 1.4,
                                      letterSpacing: -0.5,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    children: const [
                                      Text(
                                        '시작하기',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF8D6E63),
                                        ),
                                      ),
                                      Icon(
                                        Icons.chevron_right_rounded,
                                        size: 16,
                                        color: Color(0xFF8D6E63),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 80),
                          ],
                        ),
                      ),
                      Positioned(
                        top: 8,
                        right: -10,
                        child: Image.asset(
                          'assets/images/owl_intro.png',
                          height: 120,
                          fit: BoxFit.contain,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 12),

          // 학습하기 카드 아래 자동 슬라이딩 네이티브 광고
          const _HomeAdCarousel(),

          const SizedBox(height: 12),

          // 나의 목표 섹션 제목
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 24.0),
            child: Text(
              '나의 목표', 
              style: TextStyle(
                fontSize: 16, 
                fontWeight: FontWeight.w800, 
                color: Color(0xFF5D4037)
              ),
            ),
          ),
          const SizedBox(height: 16),
          
          // 리스트 카드들
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              children: [
                _buildInfoCard(
                  icon: Icons.domain_rounded,
                  iconColor: const Color(0xFF3949AB),
                  iconBgColor: const Color(0xFFE8EAF6),
                  title: '지원 회사',
                  subtitle: companyName,
                  onTap: () => _navigateToInterviewPrep(initialCompanyJobOnly: true),
                ),
                const SizedBox(height: 14),
                _buildInfoCard(
                  icon: Icons.work_rounded,
                  iconColor: const Color(0xFF00897B),
                  iconBgColor: const Color(0xFFE0F2F1),
                  title: '지원 직무',
                  subtitle: jobTitle,
                  onTap: () => _navigateToInterviewPrep(initialCompanyJobOnly: true),
                ),
                const SizedBox(height: 14),
                _buildInfoCard(
                  icon: Icons.folder_special_rounded,
                  iconColor: const Color(0xFF7E57C2),
                  iconBgColor: const Color(0xFFEDE7F6),
                  title: '주요경험 및 프로젝트',
                  subtitle: '',
                  showSubtitleLine: false,
                  onTap: () =>
                      _navigateToInterviewPrep(experienceProjectsOnly: true),
                ),
                const SizedBox(height: 14),
                _buildActionCard(
                  title: '면접 질문 시작하기',
                  subtitle: '자기소개 입력하고 맞춤형 질문 받기',
                  onTap: _navigateToInterviewQuestionStart,
                ),
              ],
            ),
          ),
          
          const SizedBox(height: 48),
        ],
      ),
    );
  }

  Widget _buildInfoCard({
    required IconData icon,
    required Color iconColor,
    required Color iconBgColor,
    required String title,
    required String subtitle,
    bool showSubtitleLine = true,
    VoidCallback? onTap,
  }) {
    final card = Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 15,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: iconBgColor,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: showSubtitleLine
                      ? EdgeInsets.zero
                      : const EdgeInsets.only(top: 6),
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF2F3542),
                    ),
                  ),
                ),
                if (showSubtitleLine) ...[
                  const SizedBox(height: 6),
                  subtitle.isEmpty
                      ? const Text(
                          '설정된 정보가 없습니다',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: Color(0xFFBDBDBD),
                          ),
                        )
                      : Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8F9FA),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Text(
                            subtitle,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF4B5563),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                ] else ...[
                  const SizedBox(height: 6),
                  const SizedBox(height: 22),
                ],
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: Color(0xFFDFE4EA), size: 26),
        ],
      ),
    );
    if (onTap == null) return card;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: card,
      ),
    );
  }

  Widget _buildActionCard({
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFFFD54F), width: 2),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFFFD54F).withValues(alpha: 0.15),
              blurRadius: 15,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 22),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                color: Color(0xFFFFF8E1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.mic_rounded, color: Color(0xFFE65100), size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF4E342E),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF3E0),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'NEW', 
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFFE65100))
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF8D6E63),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 홈 화면 학습하기 카드 아래 자동 슬라이딩 네이티브 광고 캐러셀.
/// 광고 2개가 오른쪽 방향으로 무한 순환합니다.
class _HomeAdCarousel extends StatefulWidget {
  const _HomeAdCarousel();

  @override
  State<_HomeAdCarousel> createState() => _HomeAdCarouselState();
}

class _HomeAdCarouselState extends State<_HomeAdCarousel> {
  static const int _adCount = 2;
  static const int _virtualCount = _adCount * 10000;
  static const int _initialPage = _adCount * 5000;

  late final PageController _controller =
      PageController(initialPage: _initialPage);
  Timer? _timer;
  int _loadedCount = 0;
  bool _sliding = false;
  int _slidesCompleted = 0;
  // 한 바퀴 완료마다 증가 → 광고 위젯 키가 바뀌어 새 광고 로드
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _startFallbackTimer();
  }

  void _startFallbackTimer() {
    Timer(const Duration(seconds: 8), () {
      if (mounted && _timer == null) _scheduleNext(delay: const Duration(seconds: 2));
    });
  }

  void _onAdLoaded() {
    if (!mounted) return;
    _loadedCount++;
    if (_loadedCount >= _adCount && _timer == null) {
      _scheduleNext(delay: const Duration(seconds: 2));
    }
  }

  void _scheduleNext({Duration delay = const Duration(seconds: 6)}) {
    _timer?.cancel();
    _timer = Timer(delay, () async {
      if (!mounted || !_controller.hasClients || _sliding) return;
      _sliding = true;
      await _controller.nextPage(
        duration: const Duration(milliseconds: 900),
        curve: Curves.easeInOutCubic,
      );
      _sliding = false;
      if (!mounted) return;

      _slidesCompleted++;
      // _adCount 슬라이드(한 바퀴) 완료마다 새 광고 로드
      if (_slidesCompleted % _adCount == 0) {
        _timer = null; // onAdLoaded에서 재시작할 수 있도록 null 유지
        setState(() {
          _generation++;
          _loadedCount = 0;
        });
        _startFallbackTimer(); // 광고 로드가 늦을 경우 8초 후 재개
      } else {
        _scheduleNext();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 68,
      child: PageView.builder(
        controller: _controller,
        itemCount: _virtualCount,
        itemBuilder: (context, index) {
          final slot = index % _adCount;
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: _HomeAdSlot(
              key: ValueKey('home_ad_${slot}_$_generation'),
              onLoaded: _onAdLoaded,
            ),
          );
        },
      ),
    );
  }
}

class _HomeAdSlot extends StatefulWidget {
  const _HomeAdSlot({super.key, required this.onLoaded});
  final VoidCallback onLoaded;

  @override
  State<_HomeAdSlot> createState() => _HomeAdSlotState();
}

class _HomeAdSlotState extends State<_HomeAdSlot> {
  NativeAd? _nativeAd;
  bool _isLoaded = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb && AdmobConfig.supportedPlatform) _loadAd();
  }

  void _loadAd() {
    final ad = NativeAd(
      adUnitId: AdmobConfig.recordNativeUnitId,
      factoryId: 'recordAd',
      request: const AdRequest(),
      listener: NativeAdListener(
        onAdLoaded: (ad) {
          if (!mounted) { ad.dispose(); return; }
          setState(() { _nativeAd = ad as NativeAd; _isLoaded = true; });
          widget.onLoaded();
        },
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
          debugPrint('[HomeAdSlot] 로드 실패: $error');
          widget.onLoaded();
        },
      ),
    );
    ad.load();
  }

  @override
  void dispose() { _nativeAd?.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    if (!_isLoaded || _nativeAd == null) return const SizedBox.shrink();
    return SizedBox(height: 68, child: AdWidget(ad: _nativeAd!));
  }
}
