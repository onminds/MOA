import 'package:flutter/material.dart';

import '../utils/interview_score_display.dart';

/// `evaluate-voice` 응답 맵과 동일한 키(overallScore, tone, …)를 표시.
class InterviewVoiceEvaluationBody extends StatelessWidget {
  const InterviewVoiceEvaluationBody({
    super.key,
    required this.voice,
  });

  final Map<String, dynamic> voice;

  @override
  Widget build(BuildContext context) {
    final overall = (voice['overallScore'] as num?)?.toDouble();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFD7CCC8)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Center(
            child: Column(
              children: [
                Text(
                  formatAiScoreFraction(overall),
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFFFA000),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  '종합 음성 점수',
                  style: TextStyle(
                    fontSize: 15,
                    color: Color(0xFF111827),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFD7CCC8)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '세부 평가',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF581C87),
                ),
              ),
              const SizedBox(height: 12),
              _VoiceEvaluationItem('음성 톤', voice['tone']),
              _VoiceEvaluationItem('말하기 속도', voice['pace']),
              _VoiceEvaluationItem('음량', voice['volume']),
              _VoiceEvaluationItem('명료도', voice['clarity']),
              _VoiceEvaluationItem('자신감', voice['confidence']),
              _VoiceEvaluationItem('표현력', voice['expressiveness']),
              _VoiceEvaluationItem('구조화', voice['structure']),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _VoiceColoredBlock(
          title: '강점',
          accent: Color(0xFF065F46),
          bg: Color(0xFFD1FAE5),
          border: Color(0xFF86EFAC),
          innerBg: Color(0xFFECFDF5),
          leftBorder: Color(0xFF34D399),
          icon: Icons.check_circle,
          iconColor: Color(0xFF059669),
          items: _listOfString(voice['strengths']),
        ),
        const SizedBox(height: 16),
        _VoiceColoredBlock(
          title: '개선점',
          accent: Color(0xFF7F1D1D),
          bg: Color(0xFFFEE2E2),
          border: Color(0xFFFECACA),
          innerBg: Color(0xFFFEF2F2),
          leftBorder: Color(0xFFF87171),
          icon: Icons.error_outline,
          iconColor: Color(0xFFDC2626),
          items: _listOfString(voice['improvements']),
        ),
        const SizedBox(height: 16),
        _VoiceColoredBlock(
          title: '추천사항',
          accent: Color(0xFF5D4037),
          bg: Color(0xFFFFF8E1),
          border: Color(0xFFFFE082),
          innerBg: Color(0xFFFFFDE7),
          leftBorder: Color(0xFFFFC107),
          icon: Icons.lightbulb_outline,
          iconColor: Color(0xFFFFC107),
          items: _listOfString(voice['recommendations']),
          bulletStyle: true,
        ),
        if (voice['detailedAnalysis'] != null &&
            voice['detailedAnalysis'].toString().trim().isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text(
            '상세 분석',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: SelectableText(
              voice['detailedAnalysis'].toString(),
              style: const TextStyle(fontSize: 14, height: 1.55, color: Color(0xFF374151)),
            ),
          ),
        ],
      ],
    );
  }

  static List<String> _listOfString(dynamic v) {
    if (v is! List) return [];
    return v.map((e) => e.toString()).where((s) => s.trim().isNotEmpty).toList();
  }
}

class _VoiceColoredBlock extends StatelessWidget {
  const _VoiceColoredBlock({
    required this.title,
    required this.accent,
    required this.bg,
    required this.border,
    required this.innerBg,
    required this.leftBorder,
    required this.icon,
    required this.iconColor,
    required this.items,
    this.bulletStyle = false,
  });

  final String title;
  final Color accent;
  final Color bg;
  final Color border;
  final Color innerBg;
  final Color leftBorder;
  final IconData icon;
  final Color iconColor;
  final List<String> items;
  final bool bulletStyle;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 18),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: accent,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...items.map((s) {
            if (bulletStyle) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('• ', style: TextStyle(color: Color(0xFFFFC107), fontWeight: FontWeight.bold)),
                    Expanded(
                      child: SelectableText(
                        s,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFFFF8F00),
                          height: 1.5,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: innerBg,
                  borderRadius: BorderRadius.circular(8),
                  border: Border(
                    left: BorderSide(color: leftBorder, width: 3),
                  ),
                ),
                child: SelectableText(
                  s,
                  style: TextStyle(
                    fontSize: 13,
                    color: accent,
                    fontWeight: FontWeight.w500,
                    height: 1.45,
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _VoiceEvaluationItem extends StatelessWidget {
  const _VoiceEvaluationItem(this.label, this.value);

  final String label;
  /// API가 String 외 타입을 줄 수 있어 dynamic으로 받고 문자열로만 표시
  final dynamic value;

  @override
  Widget build(BuildContext context) {
    final text = value == null ? '' : value.toString();
    if (text.trim().isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFFAF5FF),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
                color: Color(0xFF6B21A8),
              ),
            ),
            const SizedBox(height: 4),
            SelectableText(
              text,
              style: const TextStyle(
                fontSize: 13,
                height: 1.45,
                color: Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
