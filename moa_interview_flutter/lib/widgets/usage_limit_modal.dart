import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../pages/plan_page.dart';
import '../services/auth_service.dart';

class UsageLimitModal extends StatefulWidget {
  const UsageLimitModal({
    super.key,
    required this.onClose,
    this.currentUsage = 0,
    this.maxLimit = 0,
    this.serviceType,
    this.resetDate,
  });

  final VoidCallback onClose;
  final int currentUsage;
  final int maxLimit;
  final String? serviceType;
  final DateTime? resetDate;

  @override
  State<UsageLimitModal> createState() => _UsageLimitModalState();
}

class _UsageLimitModalState extends State<UsageLimitModal> {
  double _dragStartY = 0;
  double _dragTranslateY = 0;
  bool _dragging = false;
  String _countdown = '';
  Timer? _countdownTimer;

  void _handleDragStart(DragStartDetails details) {
    setState(() {
      _dragStartY = details.globalPosition.dy;
      _dragging = true;
    });
  }

  void _handleDragUpdate(DragUpdateDetails details) {
    if (!_dragging) return;
    final delta = details.globalPosition.dy - _dragStartY;
    setState(() {
      _dragTranslateY = delta > 0 ? delta : 0;
    });
  }

  void _handleDragEnd(DragEndDetails details) {
    if (_dragTranslateY > 120) {
      widget.onClose();
    } else {
      setState(() {
        _dragTranslateY = 0;
      });
    }
    setState(() {
      _dragging = false;
    });
  }

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    final resetDate = widget.resetDate;
    final serviceType = widget.serviceType;

    print('[UsageLimitModal] 디버그: serviceType=$serviceType, resetDate=$resetDate');

    if (resetDate == null) {
      print('[UsageLimitModal] 카운트다운 표시 안 함: resetDate가 null');
      setState(() {
        _countdown = '';
      });
      return;
    }

    // 생산성 도구인지 체크
    final productivityTools = [
      'productivity',
      'ai-summary',
      'cover-letter',
      'interview-prep',
      'code-generate',
      'lecture-notes',
      'report-writers',
      'sns-post',
      'presentation-script',
      'code-review',
      'ai-chat',
    ];
    
    final isProductivityTool = serviceType != null && productivityTools.contains(serviceType);
    
    if (!isProductivityTool) {
      // 생산성 도구가 아니면 카운트다운 표시 안 함 (이미지/영상은 월 단위)
      print('[UsageLimitModal] 카운트다운 표시 안 함: 생산성 도구가 아님');
      setState(() {
        _countdown = '';
      });
      return;
    }

    print('[UsageLimitModal] 카운트다운 시작! (생산성 도구)');
    _updateCountdown();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateCountdown();
    });
  }

  void _updateCountdown() {
    final resetDate = widget.resetDate;
    if (resetDate == null) {
      setState(() {
        _countdown = '';
      });
      return;
    }

    try {
      final now = DateTime.now();
      final diffMs = resetDate.difference(now).inMilliseconds;

      if (diffMs <= 0) {
        setState(() {
          _countdown = '곧 초기화됩니다';
        });
        return;
      }

      final diffDays = diffMs ~/ (1000 * 60 * 60 * 24);
      final diffHours = (diffMs % (1000 * 60 * 60 * 24)) ~/ (1000 * 60 * 60);
      final diffMinutes = (diffMs % (1000 * 60 * 60)) ~/ (1000 * 60);
      final diffSeconds = (diffMs % (1000 * 60)) ~/ 1000;

      String countdownText;
      if (diffDays > 0) {
        final month = resetDate.month;
        final day = resetDate.day;
        countdownText = '$month월 $day일 초기화';
      } else if (diffHours > 0) {
        countdownText = '$diffHours시간 $diffMinutes분 $diffSeconds초 후 초기화';
      } else if (diffMinutes > 0) {
        countdownText = '$diffMinutes분 $diffSeconds초 후 초기화';
      } else {
        countdownText = '$diffSeconds초 후 초기화';
      }

      setState(() {
        _countdown = countdownText;
      });
    } catch (e) {
      setState(() {
        _countdown = '';
      });
    }
  }

  Future<void> _openPlanPage() async {
    // iOS/Android 모두 앱 내 플랜 페이지 사용 (Google Play 정책 준수)
    if (Platform.isIOS || Platform.isAndroid) {
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const PlanPage()),
      );
      return;
    }

    // 기타 플랫폼(웹 등): 토큰과 함께 웹앱으로 이동
    final auth = AuthService.instance;
    await auth.restoreSession();
    final token = auth.token;
    
    if (token == null || token.isEmpty) {
      final uri = Uri.parse('https://www.moa.tools/plan');
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('플랜 페이지를 열 수 없습니다.')),
          );
        }
      }
      return;
    }

    final uri = Uri.https('www.moa.tools', '/mobile-link', {
      'token': token,
      'redirect': '/plan',
    });

    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('플랜 페이지를 열 수 없습니다. 잠시 후 다시 시도해주세요.')),
      );
    }
  }

  Widget _buildContent(BuildContext context) {
    final theme = Theme.of(context);
    
    // 디버깅용 로그
    print('[UsageLimitModal] _buildContent: countdown="$_countdown", serviceType="${widget.serviceType}"');
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '모든 크레딧을 사용했습니다',
          style: theme.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w900,
            color: const Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '더 똑똑한 AI로 업무 효율을 200% 높일 준비가 되셨나요?',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: const Color(0xFF374151),
          ),
        ),
        if (_countdown.isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              const Text(
                '⏰',
                style: TextStyle(fontSize: 16),
              ),
              const SizedBox(width: 6),
              Text(
                _countdown,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: const Color(0xFFD97706),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ] else if (widget.maxLimit > 0) ...[
          const SizedBox(height: 4),
          Text(
            '현재 ${widget.currentUsage}/${widget.maxLimit} 사용됨',
            style: theme.textTheme.bodySmall?.copyWith(
              color: const Color(0xFF6B7280),
            ),
          ),
        ],
        const SizedBox(height: 24),
        _buildPlanCard(
          context,
          name: 'Standard Plan',
          price: '15,900원',
          priceUnit: '/월',
          subtitle: '개인 사용자를 위한 표준 플랜',
          features: const [
            '월 80회 이미지 생성',
            '월 20회 영상 생성',
            '생산성 도구 통합 120회',
            '커뮤니티 읽기',
            '이메일 지원',
            '광고 제거',
          ],
          highlight: false,
        ),
        const SizedBox(height: 16),
        _buildPlanCard(
          context,
          name: 'Pro Plan',
          price: '29,000원',
          priceUnit: '/월',
          subtitle: '팀과 기업을 위한 고급 기능',
          features: const [
            '월 180회 이미지 생성',
            '월 40회 영상 생성',
            '생산성 도구 통합 250회',
            '커뮤니티 읽기',
            '이메일 지원',
            '광고 제거',
          ],
          highlight: true,
        ),
      ],
    );
  }

  Widget _buildPlanCard(
    BuildContext context, {
    required String name,
    required String price,
    required String priceUnit,
    String? subtitle,
    required List<String> features,
    required bool highlight,
  }) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: highlight ? Colors.black : const Color(0xFFD1D5DB),
          width: highlight ? 2 : 1,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            offset: Offset(0, 1),
            blurRadius: 3,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            name,
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
              color: const Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                price,
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF111827),
                ),
              ),
              const SizedBox(width: 4),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  priceUnit,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: const Color(0xFF6B7280),
                  ),
                ),
              ),
            ],
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF6B7280),
              ),
            ),
          ],
          const SizedBox(height: 16),
          ...features.map(
            (feature) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: Text(
                      '✓',
                      style: TextStyle(
                        color: Color(0xFF111827),
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      feature,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF374151),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _openPlanPage,
              style: ElevatedButton.styleFrom(
                backgroundColor: highlight ? Colors.black : const Color(0xFF1F2937),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: const Text(
                '업그레이드',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 720;

    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          // 어두운 배경
          Positioned.fill(
            child: GestureDetector(
              onTap: widget.onClose,
              child: Container(
                color: Colors.black.withValues(alpha: 0.4),
              ),
            ),
          ),

          // 데스크톱: 중앙 모달
          if (!isMobile)
            Center(
              child: Container(
                width: MediaQuery.of(context).size.width * 0.9,
                constraints: const BoxConstraints(maxWidth: 900),
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x33000000),
                      offset: Offset(0, 20),
                      blurRadius: 60,
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        IconButton(
                          onPressed: widget.onClose,
                          icon: const Icon(Icons.close, color: Color(0xFF6B7280)),
                        ),
                      ],
                    ),
                    Flexible(
                      child: SingleChildScrollView(
                        child: _buildContent(context),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // 모바일: 바텀시트
          if (isMobile)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: GestureDetector(
                onVerticalDragStart: _handleDragStart,
                onVerticalDragUpdate: _handleDragUpdate,
                onVerticalDragEnd: _handleDragEnd,
                child: AnimatedContainer(
                  duration: _dragging
                      ? Duration.zero
                      : const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  transform: Matrix4.translationValues(0, _dragTranslateY, 0),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
                    boxShadow: [
                      BoxShadow(
                        color: Color(0x33000000),
                        offset: Offset(0, -4),
                        blurRadius: 20,
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(height: 12),
                      Container(
                        width: 40,
                        height: 6,
                        decoration: BoxDecoration(
                          color: const Color(0xFFD1D5DB),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 8, right: 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            IconButton(
                              onPressed: widget.onClose,
                              icon: const Icon(
                                Icons.close,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ],
                        ),
                      ),
                      ConstrainedBox(
                        constraints: BoxConstraints(
                          maxHeight: MediaQuery.of(context).size.height * 0.7,
                        ),
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                          child: _buildContent(context),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

