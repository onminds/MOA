import 'package:flutter/material.dart';

/// 홈 탭 튜토리얼 단계 수 (0~1, 총 2단계)
const int kHomeTabsTutorialTotalSteps = 2;

/// 홈 하단 탭 튜토리얼 오버레이.
///
/// step 0: 기록 탭 하이라이트
/// step 1: 내점수 탭 하이라이트
class HomeTabsTutorialOverlay extends StatefulWidget {
  const HomeTabsTutorialOverlay({
    super.key,
    required this.stackKey,
    required this.step,
    required this.recordsTabKey,
    required this.myScoreTabKey,
    required this.onTap,
  });

  final GlobalKey stackKey;
  final int step;
  final GlobalKey recordsTabKey;
  final GlobalKey myScoreTabKey;
  final VoidCallback onTap;

  @override
  State<HomeTabsTutorialOverlay> createState() =>
      _HomeTabsTutorialOverlayState();
}

class _HomeTabsTutorialOverlayState extends State<HomeTabsTutorialOverlay> {
  Rect? _holeRect;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scheduleHoleUpdate());
  }

  @override
  void didUpdateWidget(HomeTabsTutorialOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.step != widget.step) {
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _scheduleHoleUpdate());
    }
  }

  GlobalKey _targetKey() =>
      widget.step == 0 ? widget.recordsTabKey : widget.myScoreTabKey;

  Future<void> _scheduleHoleUpdate() async {
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return;
    _recomputeHoleRect();
  }

  void _recomputeHoleRect() {
    final stackCtx = widget.stackKey.currentContext;
    final targetCtx = _targetKey().currentContext;
    if (stackCtx == null || targetCtx == null) {
      if (mounted) setState(() => _holeRect = null);
      return;
    }
    final stackBox = stackCtx.findRenderObject() as RenderBox?;
    final targetBox = targetCtx.findRenderObject() as RenderBox?;
    if (stackBox == null ||
        targetBox == null ||
        !targetBox.hasSize ||
        !stackBox.hasSize) {
      if (mounted) setState(() => _holeRect = null);
      return;
    }
    final topLeft = targetBox.localToGlobal(Offset.zero, ancestor: stackBox);
    // 탭 아이콘 기준으로 상하좌우 충분히 확장해 탭 전체가 하이라이트 되도록
    final rect = (topLeft & targetBox.size).inflate(20);
    if (mounted) setState(() => _holeRect = rect);
  }

  String _message() {
    switch (widget.step) {
      case 0:
        return '이 탭에서 지금까지의 면접 기록을\n모아볼 수 있어요!\n날짜별로 정리된 내역과 AI 피드백을\n다시 확인해 보세요.';
      case 1:
        return '이 탭에서 나의 점수 통계와\n성장 흐름을 확인해 보세요!\n면접을 거듭할수록 점수가\n올라가는 걸 느낄 수 있을 거예요.';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final screenHeight = mq.size.height;

    // 탭 하이라이트 중앙 x 좌표 (말풍선 꼬리 위치용)
    final holeCenter = _holeRect != null
        ? (_holeRect!.left + _holeRect!.right) / 2
        : mq.size.width / 2;

    // 말풍선은 하이라이트 바로 위에 표시
    // bottom = 전체화면높이 - holeRect.top + 간격
    final tooltipBottom = _holeRect != null
        ? screenHeight - _holeRect!.top + 12
        : 120.0;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.onTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // 딤 배경 (하이라이트 구멍 포함)
          Positioned.fill(
            child: CustomPaint(
              painter: _DimWithHolePainter(
                hole: _holeRect,
                overlayColor: Colors.black.withValues(alpha: 0.6),
              ),
            ),
          ),
          // 하이라이트 테두리
          if (_holeRect != null)
            Positioned.fill(
              child: CustomPaint(
                painter: _HoleBorderPainter(rect: _holeRect!),
              ),
            ),
          // 말풍선 — 탭 아이콘 바로 위
          Positioned(
            left: 16,
            right: 16,
            bottom: tooltipBottom,
            child: Material(
              color: Colors.transparent,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF4E342E),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.2),
                          blurRadius: 12,
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _message(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            height: 1.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          '화면을 탭하면 다음 안내로 넘어가요 (${widget.step + 1}/$kHomeTabsTutorialTotalSteps)',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // 말풍선 꼬리 (▼) — 탭 중앙을 향해
                  Positioned(
                    bottom: -10,
                    left: (holeCenter - 16 - 10).clamp(8.0, mq.size.width - 52.0),
                    child: CustomPaint(
                      size: const Size(20, 10),
                      painter: _TooltipArrowPainter(),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DimWithHolePainter extends CustomPainter {
  _DimWithHolePainter({required this.hole, required this.overlayColor});

  final Rect? hole;
  final Color overlayColor;

  @override
  void paint(Canvas canvas, Size size) {
    final fullPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    if (hole == null || hole!.width <= 0 || hole!.height <= 0) {
      canvas.drawPath(fullPath, Paint()..color = overlayColor);
      return;
    }
    const r = 12.0;
    final holePath = Path()
      ..addRRect(RRect.fromRectAndRadius(hole!, const Radius.circular(r)));
    final diff =
        Path.combine(PathOperation.difference, fullPath, holePath);
    canvas.drawPath(diff, Paint()..color = overlayColor);
  }

  @override
  bool shouldRepaint(covariant _DimWithHolePainter old) =>
      old.hole != hole || old.overlayColor != overlayColor;
}

class _HoleBorderPainter extends CustomPainter {
  _HoleBorderPainter({required this.rect});

  final Rect rect;

  @override
  void paint(Canvas canvas, Size size) {
    final r = RRect.fromRectAndRadius(rect, const Radius.circular(12));
    canvas.drawRRect(
      r,
      Paint()
        ..color = const Color(0xFFFFB300)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(covariant _HoleBorderPainter old) => old.rect != rect;
}

/// 말풍선 꼬리 (아래쪽 삼각형 ▼)
class _TooltipArrowPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFF4E342E));
  }

  @override
  bool shouldRepaint(covariant _TooltipArrowPainter old) => false;
}
