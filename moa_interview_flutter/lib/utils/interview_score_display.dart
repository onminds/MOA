import 'package:flutter/material.dart';

/// AI 텍스트 평가(totalScore)·세션 평균 등과 동일한 **만점** 기준.
const int kInterviewAiScoreMaxPoints = 10;

/// 기록 대시보드 부엉 티어와 동일한 구간: 9+ 다이아, 8+ 에메랄드, 6+ 골드, 4+ 실버, 그 미만 브론즈
enum InterviewScoreTier {
  none,
  bronze,
  silver,
  gold,
  emerald,
  diamond,
}

InterviewScoreTier tierFromAverage(double? avg) {
  if (avg == null) return InterviewScoreTier.none;
  if (avg >= 9.0) return InterviewScoreTier.diamond;
  if (avg >= 8.0) return InterviewScoreTier.emerald;
  if (avg >= 6.0) return InterviewScoreTier.gold;
  if (avg >= 4.0) return InterviewScoreTier.silver;
  return InterviewScoreTier.bronze;
}

/// 등급별 표시용 (총평 카드 등)
class InterviewTierStyle {
  const InterviewTierStyle({
    required this.label,
    required this.accent,
    required this.background,
    required this.border,
    required this.icon,
  });

  final String label;
  final Color accent;
  final Color background;
  final Color border;
  final IconData icon;

  static InterviewTierStyle forTier(InterviewScoreTier t) {
    return switch (t) {
      InterviewScoreTier.none => const InterviewTierStyle(
          label: '',
          accent: Color(0xFF9CA3AF),
          background: Color(0xFFFFFFFF),
          border: Color(0xFFE5E7EB),
          icon: Icons.insights_outlined,
        ),
      InterviewScoreTier.bronze => const InterviewTierStyle(
          label: '브론즈',
          accent: Color(0xFF8D6E63),
          background: Color(0xFFFFF3E0),
          border: Color(0xFFFFCC80),
          icon: Icons.shield_rounded,
        ),
      InterviewScoreTier.silver => const InterviewTierStyle(
          label: '실버',
          accent: Color(0xFF616161),
          background: Color(0xFFF5F5F5),
          border: Color(0xFFBDBDBD),
          icon: Icons.military_tech_rounded,
        ),
      InterviewScoreTier.gold => const InterviewTierStyle(
          label: '골드',
          accent: Color(0xFFF57F17),
          background: Color(0xFFFFF8E1),
          border: Color(0xFFFFE082),
          icon: Icons.emoji_events_rounded,
        ),
      InterviewScoreTier.emerald => const InterviewTierStyle(
          label: '에메랄드',
          accent: Color(0xFF00897B),
          background: Color(0xFFE0F2F1),
          border: Color(0xFF80CBC4),
          icon: Icons.workspace_premium_rounded,
        ),
      InterviewScoreTier.diamond => const InterviewTierStyle(
          label: '다이아몬드',
          accent: Color(0xFF0288D1),
          background: Color(0xFFE1F5FE),
          border: Color(0xFF81D4FA),
          icon: Icons.auto_awesome_rounded,
        ),
    };
  }
}

/// 예: `4.0 / 10.0` — `score`가 null이면 `—`.
String formatAiScoreFraction(double? score, {int maxPoints = kInterviewAiScoreMaxPoints}) {
  if (score == null) return '—';
  final maxStr = maxPoints.toDouble().toStringAsFixed(1);
  return '${score.toStringAsFixed(1)} / $maxStr';
}

/// [evaluation_json]의 `scores` 맵 키와 한글 라벨 (AI 평가와 동일)
const Map<String, String> kInterviewSubScoreLabels = {
  'clarity': '명확성',
  'specificity': '구체성',
  'relevance': '관련성',
  'structure': '구조화',
  'impact': '전달력',
};

const List<String> kInterviewSubScoreKeyOrder = [
  'clarity',
  'specificity',
  'relevance',
  'structure',
  'impact',
];

String labelForSubScoreKey(String key) => kInterviewSubScoreLabels[key] ?? key;

/// [kInterviewSubScoreKeyOrder] 우선, 그 외 키는 뒤에 붙임 (기록 집계·상세 화면 공통)
List<MapEntry<String, double>> orderedSubScoreEntries(Map<String, double> avgs) {
  final out = <MapEntry<String, double>>[];
  for (final k in kInterviewSubScoreKeyOrder) {
    final v = avgs[k];
    if (v != null) {
      out.add(MapEntry(k, v));
    }
  }
  for (final e in avgs.entries) {
    if (!kInterviewSubScoreKeyOrder.contains(e.key)) {
      out.add(e);
    }
  }
  return out;
}
