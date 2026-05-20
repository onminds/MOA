import 'package:flutter/material.dart';
import 'dart:math' as math;

import '../utils/interview_score_display.dart';

class SubScoreColorSet {
  final Color background;
  final Color border;
  final Color accent;
  final Color text;

  const SubScoreColorSet({
    required this.background,
    required this.border,
    required this.accent,
    required this.text,
  });
}

SubScoreColorSet _getSubScoreColors(String key) {
  switch (key) {
    case 'clarity':
      return const SubScoreColorSet(
        background: Colors.white,
        border: Color(0xFFFDBA74), // 오렌지 계열 테두리
        accent: Color(0xFFEA580C), // 오렌지 명확성
        text: Color(0xFF7C2D12),
      );
    case 'specificity':
      return const SubScoreColorSet(
        background: Colors.white,
        border: Color(0xFFD7CCC8),
        accent: Color(0xFF795548), // 브라운 구체성
        text: Color(0xFF4E342E),
      );
    case 'relevance':
      return const SubScoreColorSet(
        background: Colors.white,
        border: Color(0xFF6EE7B7),
        accent: Color(0xFF059669), // 그린 관련성
        text: Color(0xFF065F46),
      );
    case 'structure':
      return const SubScoreColorSet(
        background: Colors.white,
        border: Color(0xFF93C5FD), // 블루 계열 테두리
        accent: Color(0xFF2563EB), // 블루 구조화
        text: Color(0xFF1E3A8A),
      );
    case 'impact':
      return const SubScoreColorSet(
        background: Colors.white,
        border: Color(0xFFFDA4AF), // 로즈/레드 테두리
        accent: Color(0xFFE11D48), // 레드 전달력
        text: Color(0xFF881337),
      );
    default:
      return const SubScoreColorSet(
        background: Colors.white,
        border: Color(0xFFE2E8F0),
        accent: Color(0xFF64748B), // 기본 회색
        text: Color(0xFF334155),
      );
  }
}

/// 기록 탭에서 '총 평균 점수' 탭 시 — 전체 평균 + 항목별 평균(명확성 등)
class RecordsAggregateScorePage extends StatelessWidget {
  const RecordsAggregateScorePage({
    super.key,
    required this.overallAvg,
    required this.subScoreAvgs,
  });

  final double? overallAvg;
  final Map<String, double> subScoreAvgs;

  // 티어별 환상적인 그라데이션 색상 정의 (성취감을 위해 입체적이고 화려하게 구성)
  LinearGradient _getTierGradient(InterviewScoreTier tier) {
    switch (tier) {
      case InterviewScoreTier.diamond:
        return const LinearGradient(
          colors: [Color(0xFF4FC3F7), Color(0xFF0288D1), Color(0xFF01579B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case InterviewScoreTier.emerald:
        return const LinearGradient(
          colors: [Color(0xFF80CBC4), Color(0xFF00897B), Color(0xFF004D40)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case InterviewScoreTier.gold:
        return const LinearGradient(
          colors: [Color(0xFFFFD54F), Color(0xFFF57F17), Color(0xFFE65100)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case InterviewScoreTier.silver:
        return const LinearGradient(
          colors: [Color(0xFFE0E0E0), Color(0xFF9E9E9E), Color(0xFF616161)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case InterviewScoreTier.bronze:
        return const LinearGradient(
          colors: [Color(0xFFBCAAA4), Color(0xFF8D6E63), Color(0xFF4E342E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case InterviewScoreTier.none:
      default:
        return const LinearGradient(
          colors: [Color(0xFFF3F4F6), Color(0xFFD1D5DB), Color(0xFF9CA3AF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
    }
  }

  // 전체 평균 아이콘 및 전반적 섀도우컬러
  Color _getTierShadowColor(InterviewScoreTier tier) {
    switch (tier) {
      case InterviewScoreTier.diamond: return const Color(0xFF0288D1);
      case InterviewScoreTier.emerald: return const Color(0xFF00897B);
      case InterviewScoreTier.gold: return const Color(0xFFF57F17);
      case InterviewScoreTier.silver: return const Color(0xFF9E9E9E);
      case InterviewScoreTier.bronze: return const Color(0xFF8D6E63);
      case InterviewScoreTier.none: return const Color(0xFF9CA3AF);
    }
  }

  @override
  Widget build(BuildContext context) {
    final entries = orderedSubScoreEntries(subScoreAvgs);
    final tier = tierFromAverage(overallAvg);
    final tierStyle = InterviewTierStyle.forTier(tier);
    final gradient = _getTierGradient(tier);
    final shadowColor = _getTierShadowColor(tier);

    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFFFDFBF7),
        foregroundColor: const Color(0xFF5D4037),
        title: const Text(
          '총 평균 점수',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 전체 평균 대시보드 카드 (화려한 티어별 그라데이션 및 입장 애니메이션 적용)
            TweenAnimationBuilder<double>(
              tween: Tween<double>(begin: 0.0, end: 1.0),
              duration: const Duration(milliseconds: 1600),
              curve: Curves.easeOutCubic, // 부드럽게 감속하며 랜딩
              builder: (context, animValue, child) {
                final currentAvg = overallAvg != null ? overallAvg! * animValue : null;
                
                return Transform.translate(
                  offset: Offset(0, 30 * (1 - animValue)), // 아래에서 위로 살짝 올라오는 효과
                  child: Opacity(
                    opacity: animValue.clamp(0.0, 1.0),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: gradient,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: shadowColor.withValues(alpha: 0.4 * animValue),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          // 우측 거대 배경 아이콘 (워터마크 회전 및 팝업 애니메이션)
                          if (tier != InterviewScoreTier.none)
                            Positioned(
                              right: -20 + (20 * (1 - animValue)),
                              bottom: -20 + (20 * (1 - animValue)),
                              child: Transform.rotate(
                                angle: (1 - animValue) * -0.5, // 살짝 돌아가면서 안착
                                child: Opacity(
                                  opacity: 0.15 * animValue,
                                  child: Icon(
                                    tierStyle.icon,
                                    size: 180,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.all(28.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      '나의 전체 평균',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white.withValues(alpha: 0.9),
                                      ),
                                    ),
                                    const Spacer(),
                                    if (tier != InterviewScoreTier.none)
                                      Transform.scale(
                                        scale: 0.8 + 0.2 * animValue, // 티어 뱃지 팝 효과
                                        child: Opacity(
                                          opacity: animValue,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                            decoration: BoxDecoration(
                                              color: Colors.white.withValues(alpha: 0.25),
                                              borderRadius: BorderRadius.circular(20),
                                              border: Border.all(
                                                color: Colors.white.withValues(alpha: 0.5),
                                                width: 1,
                                              ),
                                            ),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(tierStyle.icon, size: 14, color: Colors.white),
                                                const SizedBox(width: 4),
                                                Text(
                                                  tierStyle.label,
                                                  style: const TextStyle(
                                                    fontSize: 13,
                                                    fontWeight: FontWeight.w900,
                                                    color: Colors.white,
                                                    letterSpacing: 0.5,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 20),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                     Text(
                                      // 숫자가 0부터 주르륵 카운팅되는 롤링 애니메이션 적용!
                                      currentAvg != null ? currentAvg.toStringAsFixed(1) : '—',
                                      style: const TextStyle(
                                        fontSize: 46,
                                        fontWeight: FontWeight.w900,
                                        color: Colors.white,
                                        letterSpacing: -1.5,
                                        height: 1.0,
                                        shadows: [
                                          Shadow(
                                            color: Colors.black26,
                                            offset: Offset(0, 4),
                                            blurRadius: 8,
                                          ),
                                        ],
                                      ),
                                    ),
                                    const Padding(
                                      padding: EdgeInsets.only(bottom: 6.0, left: 4.0),
                                      child: Text(
                                        ' / 10.0',
                                        style: TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.w700,
                                          color: Colors.white70,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Opacity(
                                  opacity: animValue,
                                  child: Text(
                                    overallAvg != null && overallAvg! >= 8.0 
                                      ? '상위 티어에 완벽히 정착했어요!' 
                                      : '상위 티어를 향해 달려가고 있어요!',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.white.withValues(alpha: 0.8),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Positioned(
                            bottom: 12,
                            right: 12,
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                borderRadius: BorderRadius.circular(20),
                                onTap: () => _showTierInfoDialog(context),
                                child: Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.2),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.help_outline_rounded, color: Colors.white, size: 18),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
            
            const SizedBox(height: 48),
            
            // 항목별 평균 헤더
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0xFFFFF3E0),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.bar_chart_rounded, size: 20, color: Color(0xFFE65100)),
                ),
                const SizedBox(width: 10),
                const Text(
                  '항목별 세부 분석',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF4E342E),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Padding(
              padding: EdgeInsets.only(left: 4),
              child: Text(
                '지금까지 진행한 면접 기록의 AI 세부 평가를 평균 낸 결과입니다.',
                style: TextStyle(
                  fontSize: 13,
                  height: 1.4,
                  color: Color(0xFF8D6E63),
                ),
              ),
            ),
            const SizedBox(height: 20),
            
            if (entries.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFEFEBE9)),
                ),
                child: const Center(
                  child: Text(
                    '항목별 점수가 있는 기록이 없어요.\n면접 연습 후 평가가 저장되면 표시됩니다.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFA1887F),
                    ),
                  ),
                ),
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // 1. 거미줄 차트 (개별 항목 색상 적용 및 2.0/10 포맷)
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 44, 16, 44),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.03),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                      border: Border.all(color: const Color(0xFFF3F4F6)),
                    ),
                    child: AnimatedSpiderChart(
                      labels: entries.map<String>((e) => labelForSubScoreKey(e.key)).toList(),
                      scores: entries.map<double>((e) => e.value).toList(),
                      colors: entries.map<Color>((e) => _getSubScoreColors(e.key).accent).toList(),
                      maxScore: 10.0,
                    ),
                  ),
                  const SizedBox(height: 28),
                  
                  // 2. 현대적인 그리드 카드 뷰 (각 항목별 고유 색상 및 테마 적용)
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 14,
                      crossAxisSpacing: 14,
                      childAspectRatio: 1.4,
                    ),
                    itemCount: entries.length,
                    itemBuilder: (context, index) {
                      final e = entries[index];
                      final double percent = (e.value / 10.0).clamp(0.0, 1.0);
                      final itemColors = _getSubScoreColors(e.key);
                      
                      return Container(
                        decoration: BoxDecoration(
                          color: itemColors.background,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.02),
                              blurRadius: 10,
                              offset: const Offset(0, 5),
                            ),
                          ],
                          border: Border.all(color: itemColors.border),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 18.0, vertical: 16.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                labelForSubScoreKey(e.key),
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: itemColors.text,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    e.value.toStringAsFixed(1),
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 22,
                                      color: itemColors.accent,
                                      letterSpacing: -0.5,
                                      height: 1.0,
                                    ),
                                  ),
                                  const Padding(
                                    padding: EdgeInsets.only(bottom: 2.0, left: 2.0),
                                    child: Text(
                                      ' / 10',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF9CA3AF),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const Spacer(),
                              // 개별 항목 테마가 반영된 프로그레스 바
                              Stack(
                                children: [
                                  Container(
                                    height: 6,
                                    width: double.infinity,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE5E7EB),
                                      borderRadius: BorderRadius.circular(3),
                                    ),
                                  ),
                                  LayoutBuilder(
                                    builder: (context, constraints) {
                                      return Container(
                                        height: 6,
                                        width: constraints.maxWidth * percent,
                                        decoration: BoxDecoration(
                                          color: itemColors.accent, 
                                          borderRadius: BorderRadius.circular(3),
                                        ),
                                      );
                                    },
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  void _showTierInfoDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: const Text(
            '부엉 스피치 티어 안내',
            style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF4E342E), fontSize: 18),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildTierRow(Icons.auto_awesome_rounded, '다이아몬드', '9.0 ~ 10.0', const Color(0xFF0288D1), const Color(0xFFE1F5FE)),
              const SizedBox(height: 14),
              _buildTierRow(Icons.workspace_premium_rounded, '에메랄드', '8.0 ~ 8.9', const Color(0xFF00897B), const Color(0xFFE0F2F1)),
              const SizedBox(height: 14),
              _buildTierRow(Icons.emoji_events_rounded, '골드', '6.0 ~ 7.9', const Color(0xFFF57F17), const Color(0xFFFFF8E1)),
              const SizedBox(height: 14),
              _buildTierRow(Icons.military_tech_rounded, '실버', '4.0 ~ 5.9', const Color(0xFF616161), const Color(0xFFF5F5F5)),
              const SizedBox(height: 14),
              _buildTierRow(Icons.shield_rounded, '브론즈', '0.0 ~ 3.9', const Color(0xFF8D6E63), const Color(0xFFFFF3E0)),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              ),
              child: const Text('확인', style: TextStyle(color: Color(0xFF5D4037), fontWeight: FontWeight.bold, fontSize: 15)),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTierRow(IconData icon, String label, String range, Color color, Color bgColor) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: color, size: 20),
        ),
        const SizedBox(width: 14),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF4E342E))),
        const Spacer(),
        Text(range, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Color(0xFF8D6E63))),
      ],
    );
  }
}


/// [AnimatedSpiderChart] — 항목별 세부 점수를 거미줄(레이더) 형태로 시각화
class AnimatedSpiderChart extends StatefulWidget {
  final List<String> labels;
  final List<double> scores;
  final List<Color> colors;
  final double maxScore;

  const AnimatedSpiderChart({
    super.key,
    required this.labels,
    required this.scores,
    required this.colors,
    required this.maxScore,
  });

  @override
  State<AnimatedSpiderChart> createState() => _AnimatedSpiderChartState();
}

class _AnimatedSpiderChartState extends State<AnimatedSpiderChart> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    // 애니메이션 길이를 길게 잡아 서서히 차오르는 세련된 느낌을 줍니다.
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800));
    // 뷰 진입 시 약간의 딜레이 후 시작되어 자연스럽게 나타납니다.
    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return CustomPaint(
          size: const Size(double.infinity, 240),
          painter: _SpiderChartPainter(
            labels: widget.labels,
            scores: widget.scores,
            colors: widget.colors,
            maxScore: widget.maxScore,
            progress: _controller.value, // 선형 진행도로 Painter에서 곡률 직접 스태거링
          ),
        );
      },
    );
  }
}

class _SpiderChartPainter extends CustomPainter {
  final List<String> labels;
  final List<double> scores;
  final List<Color> colors;
  final double maxScore;
  final double progress;

  _SpiderChartPainter({
    required this.labels,
    required this.scores,
    required this.colors,
    required this.maxScore,
    required this.progress,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final int N = labels.length;
    if (N < 3) return;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 * 0.65;
    final angleStep = 2 * math.pi / N;

    // --- 1. 배경 애니메이션 (스케일 + 페이드인) ---
    final bgProgress = (progress / 0.4).clamp(0.0, 1.0); // 앞단 40% 내에 배경 완성
    final bgScale = Curves.easeOutCubic.transform(bgProgress); // 배경은 서서히 커짐
    final bgOpacity = bgProgress;
    
    // --- 2. 텍스트 라벨 애니메이션 (서서히 페이드 인) ---
    final textOpacity = ((progress - 0.2) / 0.5).clamp(0.0, 1.0); // 앞부분 이후 등장
    
    // --- 3. 항목 점수별 딜레이 & 스태거(Stagger) 매핑 ---
    final List<double> axisProgress = List.generate(N, (i) {
      // 0.0부터 차례대로(시계방향) 지연 시작하여 통통 튀어나옵니다
      final delay = i * 0.10; 
      double t = (progress - delay) / 0.5; 
      t = t.clamp(0.0, 1.0);
      return Curves.easeOutBack.transform(t); // 통통 튀는 탄력
    });

    // 배경이 그리기 시작했을 때
    if (bgOpacity > 0) {
      final gridPaint = Paint()
        ..color = const Color(0xFFF3F4F6).withValues(alpha: bgOpacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0;

      final bgFillPaint = Paint()
        ..color = const Color(0xFFF9FAFB).withValues(alpha: bgOpacity)
        ..style = PaintingStyle.fill;

      const int gridLevels = 4;
      for (int level = gridLevels; level >= 1; level--) {
        // 크기 스케일에 맞춰 등장
        final r = radius * (level / gridLevels) * (0.8 + 0.2 * bgScale); 
        final path = Path();
        for (int i = 0; i < N; i++) {
          final a = -math.pi / 2 + i * angleStep;
          final p = Offset(center.dx + r * math.cos(a), center.dy + r * math.sin(a));
          if (i == 0) {
            path.moveTo(p.dx, p.dy);
          } else {
            path.lineTo(p.dx, p.dy);
          }
        }
        path.close();
        if (level == gridLevels) {
          canvas.drawPath(path, bgFillPaint);
        }
        canvas.drawPath(path, gridPaint);
      }

      // 중심부터 각 꼭짓점 축 그리기
      for (int i = 0; i < N; i++) {
        final a = -math.pi / 2 + i * angleStep;
        final currR = radius * (0.8 + 0.2 * bgScale);
        final p = Offset(center.dx + currR * math.cos(a), center.dy + currR * math.sin(a));
        canvas.drawLine(center, p, gridPaint);
      }
    }

    // 실제 점수 데이터 폴리곤 그리기 (스태거 시퀀스 적용)
    final dataPath = Path();
    for (int i = 0; i < N; i++) {
      final score = scores[i] * axisProgress[i];
      final r = radius * (score / maxScore);
      final a = -math.pi / 2 + i * angleStep;
      final p = Offset(center.dx + r * math.cos(a), center.dy + r * math.sin(a));
      if (i == 0) {
        dataPath.moveTo(p.dx, p.dy);
      } else {
        dataPath.lineTo(p.dx, p.dy);
      }
    }
    dataPath.close();

    // 점수 영역 면 페이드 인
    final fillOpacity = ((progress - 0.2) * 1.5).clamp(0.0, 1.0) * 0.15;
    if (fillOpacity > 0) {
      final fillPaint = Paint()
        ..color = const Color(0xFF9CA3AF).withValues(alpha: fillOpacity)
        ..style = PaintingStyle.fill;
      canvas.drawPath(dataPath, fillPaint);
    }

    // 점수 영역 테두리 그리기
    final strokeOpacity = ((progress - 0.1) * 2.0).clamp(0.0, 1.0);
    if (strokeOpacity > 0) {
      final strokePaint = Paint()
        ..color = const Color(0xFFD1D5DB).withValues(alpha: strokeOpacity)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0
        ..strokeJoin = StrokeJoin.round;
      canvas.drawPath(dataPath, strokePaint);
    }

    // 꼭짓점 데이터 마커(컬러 포인트) 그리기
    for (int i = 0; i < N; i++) {
      if (axisProgress[i] > 0) {
        final score = scores[i] * axisProgress[i];
        final r = radius * (score / maxScore);
        final a = -math.pi / 2 + i * angleStep;
        final p = Offset(center.dx + r * math.cos(a), center.dy + r * math.sin(a));
        
        // 반짝이듯 스케일업 효과
        final markerScale = axisProgress[i].clamp(0.0, 1.0);

        final pointPaint = Paint()
          ..color = Colors.white
          ..style = PaintingStyle.fill;
        final pointBorderPaint = Paint()
          ..color = colors[i] // 각 항목 고유 색상
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5;

        canvas.drawCircle(p, 5.0 * markerScale, pointPaint);
        canvas.drawCircle(p, 5.0 * markerScale, pointBorderPaint);
      }
    }

    // 외부 라벨 텍스트
    if (textOpacity > 0) {
      for (int i = 0; i < N; i++) {
        final a = -math.pi / 2 + i * angleStep;
        // 배경 스케일에 맞춰 텍스트 위치도 자연스럽게 자리잡기
        final r = radius * (0.8 + 0.2 * bgScale) + 38.0; 
        final p = Offset(center.dx + r * math.cos(a), center.dy + r * math.sin(a));

        final textSpan = TextSpan(
          text: labels[i],
          style: TextStyle(
            color: const Color(0xFF6B7280).withValues(alpha: textOpacity),
            fontSize: 13,
            fontWeight: FontWeight.w800,
          ),
        );
        final textPainter = TextPainter(
          text: textSpan,
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.center,
        );
        textPainter.layout();
        
        final textOffset = Offset(p.dx - textPainter.width / 2, p.dy - textPainter.height / 2 - 8);
        textPainter.paint(canvas, textOffset);
        
        final valSpan = TextSpan(
          text: '${scores[i].toStringAsFixed(1)} / 10',
          style: TextStyle(
            color: colors[i].withValues(alpha: textOpacity),
            fontSize: 14,
            fontWeight: FontWeight.w900,
          ),
        );
        final valPainter = TextPainter(
          text: valSpan,
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.center,
        );
        valPainter.layout();
        final valOffset = Offset(p.dx - valPainter.width / 2, p.dy + textPainter.height / 2 - 2);
        valPainter.paint(canvas, valOffset);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SpiderChartPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.colors != colors;
  }
}
