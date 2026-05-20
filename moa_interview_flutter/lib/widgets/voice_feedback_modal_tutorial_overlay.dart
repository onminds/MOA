import 'package:flutter/material.dart';

/// 음성 평가 모달 튜토리얼 단계 수 (0~12, 총 13단계 — 답변 분석 블록 4개 포함)
const int kVoiceModalTutorialTotalSteps = 13;

/// [VoiceFeedbackModalTutorialOverlay]와 동일한 규칙으로 하이라이트·스크롤 대상 [GlobalKey]를 맞춥니다.
GlobalKey? resolveVoiceModalTutorialTargetKey({
  required int step,
  required bool hasTranscript,
  required bool hasAnswerEvaluation,
  required GlobalKey tabsKey,
  required GlobalKey transcriptKey,
  required GlobalKey answerAnalysisHeaderKey,
  required GlobalKey answerAnalysisBodyKey,
  required GlobalKey answerResultKey,
  required GlobalKey answerStrengthsKey,
  required GlobalKey answerImprovementsKey,
  required GlobalKey answerRecommendationsKey,
  required GlobalKey answerImprovedExampleKey,
  required GlobalKey voiceOverallKey,
  required GlobalKey voiceDetailKey,
  required GlobalKey voiceStrengthsKey,
  required GlobalKey voiceImprovementsKey,
  required GlobalKey voiceRecommendationsKey,
}) {
  switch (step) {
    case 0:
      return tabsKey;
    case 1:
      if (hasTranscript) return transcriptKey;
      return null;
    case 2:
      return answerAnalysisHeaderKey;
    case 3:
      if (hasAnswerEvaluation) return answerResultKey;
      return answerAnalysisBodyKey;
    case 4:
      return answerStrengthsKey;
    case 5:
      return answerImprovementsKey;
    case 6:
      return answerRecommendationsKey;
    case 7:
      return answerImprovedExampleKey;
    case 8:
      return voiceOverallKey;
    case 9:
      return voiceDetailKey;
    case 10:
      return voiceStrengthsKey;
    case 11:
      return voiceImprovementsKey;
    case 12:
      return voiceRecommendationsKey;
    default:
      return null;
  }
}

/// [Scrollable.ensureVisible]의 alignment (0=위, 1=아래).
double scrollAlignmentForVoiceModalTutorialStep(int step) {
  switch (step) {
    case 0:
      return 0.12;
    case 1:
      return 0.35;
    case 2:
    case 3:
      return 0.4;
    case 4:
    case 5:
    case 6:
    case 7:
      return 0.38;
    case 8:
      return 0.22;
    case 9:
    case 10:
    case 11:
    case 12:
      return 0.48;
    default:
      return 0.4;
  }
}

/// 음성 평가 모달: 탭으로 진행하는 딤 + 하이라이트 (레이아웃 밀림 없음)
///
/// 별도 라이브러리의 public 위젯으로 두어, 핫 리로드 시 private 위젯 생성자 불일치
/// (`NoSuchMethodError: new _VoiceFeedbackModalTutorialOverlay.()`)를 피합니다.
class VoiceFeedbackModalTutorialOverlay extends StatefulWidget {
  const VoiceFeedbackModalTutorialOverlay({
    super.key,
    required this.stackKey,
    required this.step,
    required this.hasTranscript,
    required this.hasAnswerEvaluation,
    required this.tabsKey,
    required this.transcriptKey,
    required this.answerAnalysisHeaderKey,
    required this.answerAnalysisBodyKey,
    required this.answerResultKey,
    required this.answerStrengthsKey,
    required this.answerImprovementsKey,
    required this.answerRecommendationsKey,
    required this.answerImprovedExampleKey,
    required this.voiceOverallKey,
    required this.voiceDetailKey,
    required this.voiceStrengthsKey,
    required this.voiceImprovementsKey,
    required this.voiceRecommendationsKey,
    required this.onTap,
  });

  final GlobalKey stackKey;
  final int step;
  final bool hasTranscript;
  final bool hasAnswerEvaluation;
  final GlobalKey tabsKey;
  final GlobalKey transcriptKey;
  final GlobalKey answerAnalysisHeaderKey;
  final GlobalKey answerAnalysisBodyKey;
  final GlobalKey answerResultKey;
  final GlobalKey answerStrengthsKey;
  final GlobalKey answerImprovementsKey;
  final GlobalKey answerRecommendationsKey;
  final GlobalKey answerImprovedExampleKey;
  final GlobalKey voiceOverallKey;
  final GlobalKey voiceDetailKey;
  final GlobalKey voiceStrengthsKey;
  final GlobalKey voiceImprovementsKey;
  final GlobalKey voiceRecommendationsKey;
  final VoidCallback onTap;

  @override
  State<VoiceFeedbackModalTutorialOverlay> createState() =>
      _VoiceFeedbackModalTutorialOverlayState();
}

class _VoiceFeedbackModalTutorialOverlayState
    extends State<VoiceFeedbackModalTutorialOverlay> {
  Rect? _holeRect;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _scheduleHoleUpdate());
  }

  @override
  void didUpdateWidget(VoiceFeedbackModalTutorialOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.step != widget.step ||
        oldWidget.hasTranscript != widget.hasTranscript ||
        oldWidget.hasAnswerEvaluation != widget.hasAnswerEvaluation) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _scheduleHoleUpdate());
    }
  }

  GlobalKey? _targetKeyForStep() {
    return resolveVoiceModalTutorialTargetKey(
      step: widget.step,
      hasTranscript: widget.hasTranscript,
      hasAnswerEvaluation: widget.hasAnswerEvaluation,
      tabsKey: widget.tabsKey,
      transcriptKey: widget.transcriptKey,
      answerAnalysisHeaderKey: widget.answerAnalysisHeaderKey,
      answerAnalysisBodyKey: widget.answerAnalysisBodyKey,
      answerResultKey: widget.answerResultKey,
      answerStrengthsKey: widget.answerStrengthsKey,
      answerImprovementsKey: widget.answerImprovementsKey,
      answerRecommendationsKey: widget.answerRecommendationsKey,
      answerImprovedExampleKey: widget.answerImprovedExampleKey,
      voiceOverallKey: widget.voiceOverallKey,
      voiceDetailKey: widget.voiceDetailKey,
      voiceStrengthsKey: widget.voiceStrengthsKey,
      voiceImprovementsKey: widget.voiceImprovementsKey,
      voiceRecommendationsKey: widget.voiceRecommendationsKey,
    );
  }

  Future<void> _scheduleHoleUpdate() async {
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return;
    final targetKey = _targetKeyForStep();
    final ctx = targetKey?.currentContext;
    if (ctx != null) {
      // 탭 전환·긴 목록 직후 레이아웃이 끝나기 전에 한 번만 스크롤하면
      // 대상이 화면 아래에 남아 사용자가 직접 드래그해야 하는 경우가 있어,
      // 몇 프레임에 걸쳐 ensureVisible을 반복합니다.
      final alignment = scrollAlignmentForVoiceModalTutorialStep(widget.step);
      for (var attempt = 0; attempt < 3; attempt++) {
        if (!mounted) return;
        await WidgetsBinding.instance.endOfFrame;
        if (!mounted) return;
        try {
          await Scrollable.ensureVisible(
            ctx,
            duration: Duration(milliseconds: 360 + attempt * 50),
            curve: Curves.easeInOut,
            alignment: alignment,
          );
        } catch (_) {}
        if (!mounted) return;
        if (attempt < 2) {
          await Future<void>.delayed(const Duration(milliseconds: 45));
        }
      }
    }
    if (!mounted) return;
    _recomputeHoleRect();
  }

  void _recomputeHoleRect() {
    final stackCtx = widget.stackKey.currentContext;
    final targetKey = _targetKeyForStep();
    if (stackCtx == null || targetKey == null) {
      if (mounted) setState(() => _holeRect = null);
      return;
    }
    final stackBox = stackCtx.findRenderObject() as RenderBox?;
    final targetCtx = targetKey.currentContext;
    final targetBox = targetCtx?.findRenderObject() as RenderBox?;
    if (stackBox == null ||
        targetBox == null ||
        !targetBox.hasSize ||
        !stackBox.hasSize) {
      if (mounted) setState(() => _holeRect = null);
      return;
    }
    final topLeft = targetBox.localToGlobal(Offset.zero, ancestor: stackBox);
    final rect = (topLeft & targetBox.size).inflate(6);
    if (mounted) setState(() => _holeRect = rect);
  }

  String _message() {
    switch (widget.step) {
      case 0:
        return '답변 분석·음성 평가 탭을 전환해 두 가지 피드백을 볼 수 있어요.';
      case 1:
        if (widget.hasTranscript) {
          return '인식된 텍스트를 확인하거나 수정할 수 있어요. 복사도 가능합니다.';
        }
        return '녹음이 인식되면 이곳에 텍스트가 표시됩니다. 화면을 넘겨 다음을 확인해요.';
      case 2:
        return '「답변 분석」제목과 안내, 오른쪽 재분석(또는 분석 다시 실행)으로 답변을 다시 평가할 수 있어요.';
      case 3:
        if (widget.hasAnswerEvaluation) {
          return '노란 테두리 안의 「AI 평가 결과」카드예요. 총점과 명확성·구체성 등 항목 점수를 확인하세요.';
        }
        return '분석이 끝나면 이 자리에 점수 카드가 나타나요. 지금은 안내 문구·로딩만 보일 수 있어요.';
      case 4:
        return 'AI가 짚은 강점이에요. 유지하면 좋은 점으로 삼아 보세요.';
      case 5:
        return '개선하면 좋은 부분이에요. 다음 답변 때 의식해 보세요.';
      case 6:
        return '실천해 볼 만한 추천이에요. 면접 전에 한 번씩 읽어 보세요.';
      case 7:
        return '개선된 답변 예시예요. 톤과 구성을 참고해 보세요.';
      case 8:
        return '음성 평가 탭으로 넘어왔어요. 종합 음성 점수를 먼저 확인해 보세요.';
      case 9:
        return '톤·속도·명료도 등 세부 항목별로 음성이 어떤지 설명해 드려요.';
      case 10:
        return '잘한 점을 정리한 강점입니다. 유지하면 좋은 습관을 참고하세요.';
      case 11:
        return '보완하면 좋은 부분입니다. 다음 녹음 때 의식해 보세요.';
      case 12:
        return '실천할 만한 추천입니다. 면접 전에 한 번씩 읽어 보시면 도움이 돼요.';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    // 키보드·시스템 내비 위로 설명 말풍선이 오도록 (드래그 없이도 보이게)
    final bottomPad = mq.padding.bottom + mq.viewInsets.bottom;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.onTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: _DimWithHolePainter(
                hole: _holeRect,
                overlayColor: Colors.black.withValues(alpha: 0.55),
              ),
            ),
          ),
          if (_holeRect != null)
            Positioned.fill(
              child: CustomPaint(
                painter: _HoleBorderPainter(rect: _holeRect!),
              ),
            ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 24 + bottomPad,
            child: Material(
              color: Colors.transparent,
              child: Container(
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
                        height: 1.45,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '화면을 탭하면 다음 안내로 넘어가요 (${widget.step + 1}/$kVoiceModalTutorialTotalSteps)',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 12,
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

class _DimWithHolePainter extends CustomPainter {
  _DimWithHolePainter({
    required this.hole,
    required this.overlayColor,
  });

  final Rect? hole;
  final Color overlayColor;

  @override
  void paint(Canvas canvas, Size size) {
    final fullPath = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    if (hole == null || hole!.width <= 0 || hole!.height <= 0) {
      canvas.drawPath(fullPath, Paint()..color = overlayColor);
      return;
    }
    const r = 12.0;
    final holePath = Path()
      ..addRRect(RRect.fromRectAndRadius(hole!, const Radius.circular(r)));
    final diff = Path.combine(PathOperation.difference, fullPath, holePath);
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
