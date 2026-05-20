import 'package:flutter/material.dart';

import '../services/interview_record_db.dart';
import '../utils/interview_score_display.dart';
import '../utils/interview_session_scores.dart';
import '../widgets/interview_voice_evaluation_body.dart';

/// 저장된 질문 1개에 대한 AI 평가 전체 (evaluate-answer JSON 구조 기반)
class InterviewQuestionAnalysisPage extends StatefulWidget {
  const InterviewQuestionAnalysisPage({
    super.key,
    required this.session,
    required this.item,
    required this.questionLabel,
  });

  final InterviewSessionRow session;
  final InterviewItemRow item;
  final String questionLabel;

  @override
  State<InterviewQuestionAnalysisPage> createState() =>
      _InterviewQuestionAnalysisPageState();
}

enum _EvalTab { answer, voice }

class _InterviewQuestionAnalysisPageState
    extends State<InterviewQuestionAnalysisPage> {
  late _EvalTab _tab;

  @override
  void initState() {
    super.initState();
    final hasAns =
        interviewItemAnswerEvaluationMap(widget.item) != null;
    final hasVoice =
        interviewItemVoiceEvaluationMap(widget.item) != null;
    if (hasVoice && !hasAns) {
      _tab = _EvalTab.voice;
    } else {
      _tab = _EvalTab.answer;
    }
  }

  @override
  Widget build(BuildContext context) {
    final ev = interviewItemAnswerEvaluationMap(widget.item);
    final voiceEv = interviewItemVoiceEvaluationMap(widget.item);
    final hasAnswer = ev != null;
    final hasVoice = voiceEv != null;

    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFFFDFBF7),
        foregroundColor: const Color(0xFF5D4037),
        title: Text(
          '${widget.questionLabel} AI 분석',
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '${widget.session.companyName} · ${widget.session.jobTitle}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF6B7280),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '${widget.questionLabel}. ${widget.item.question}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Color(0xFF111827),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),
            if (widget.item.answer != null &&
                widget.item.answer!.trim().isNotEmpty) ...[
              const Text(
                '나의 답변',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF5D4037),
                ),
              ),
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: SelectableText(
                  widget.item.answer!,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.5,
                    color: Color(0xFF374151),
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],
            if (!hasAnswer && !hasVoice)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  '이 질문에 대한 AI 평가가 저장되지 않았습니다.\n(분석 전에 종료한 경우)',
                  style: TextStyle(color: Color(0xFF6B7280), height: 1.5),
                ),
              )
            else ...[
              Builder(
                builder: (context) {
                  final answerScore =
                      totalScoreFromAnswerEvaluationMap(ev);
                  final voiceScore =
                      overallScoreFromVoiceEvaluationMap(voiceEv);
                  final combined = combinedAnswerVoiceAverage(
                    answerScore,
                    voiceScore,
                  );
                  return _ScoreHeader(
                    displayTotal: combined,
                    answerScore: answerScore,
                    voiceScore: voiceScore,
                  );
                },
              ),
              if (hasAnswer && hasVoice) ...[
                const SizedBox(height: 16),
                _EvalToggleBar(
                  selected: _tab,
                  onSelectAnswer: () =>
                      setState(() => _tab = _EvalTab.answer),
                  onSelectVoice: () =>
                      setState(() => _tab = _EvalTab.voice),
                ),
                const SizedBox(height: 16),
                // AnimatedSwitcher 제거: 일부 환경에서 자식 위젯이 null로 해석되는 런타임 오류 방지
                if (_tab == _EvalTab.answer)
                  _AnswerEvalPanel(
                    key: const ValueKey('answer'),
                    ev: ev,
                  )
                else
                  InterviewVoiceEvaluationBody(
                    key: const ValueKey('voice'),
                    voice: voiceEv,
                  ),
              ] else if (hasAnswer) ...[
                const SizedBox(height: 16),
                _AnswerEvalPanel(ev: ev),
              ] else ...[
                const SizedBox(height: 12),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    '답변 분석은 저장되지 않았습니다. 음성 평가만 표시합니다.',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.brown.shade700,
                      height: 1.45,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                InterviewVoiceEvaluationBody(voice: voiceEv!),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

/// 답변 AI 평가: 세부 점수 + 문단
class _AnswerEvalPanel extends StatelessWidget {
  const _AnswerEvalPanel({super.key, required this.ev});

  final Map<String, dynamic> ev;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (ev['scores'] is Map) ...[
          _SubScores(
            scores: Map<String, dynamic>.from(ev['scores'] as Map),
          ),
          const SizedBox(height: 20),
        ],
        _BulletSection(
          title: '강점',
          items: _listOfString(ev['strengths']),
        ),
        _BulletSection(
          title: '개선점',
          items: _listOfString(ev['improvements']),
        ),
        _BulletSection(
          title: '추천사항',
          items: _listOfString(ev['recommendations']),
        ),
        if (ev['improvedExample'] != null &&
            ev['improvedExample'].toString().trim().isNotEmpty) ...[
          const SizedBox(height: 8),
          const Text(
            '개선 예시 답변',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFFDE7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFFE082)),
            ),
            child: SelectableText(
              ev['improvedExample'].toString(),
              style: const TextStyle(
                fontSize: 14,
                height: 1.55,
                color: Color(0xFF374151),
              ),
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

class _EvalToggleBar extends StatelessWidget {
  const _EvalToggleBar({
    required this.selected,
    required this.onSelectAnswer,
    required this.onSelectVoice,
  });

  final _EvalTab selected;
  final VoidCallback onSelectAnswer;
  final VoidCallback onSelectVoice;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _EvalPill(
            label: '답변 평가',
            icon: Icons.article_outlined,
            selected: selected == _EvalTab.answer,
            onTap: onSelectAnswer,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _EvalPill(
            label: '음성 평가',
            icon: Icons.mic_rounded,
            selected: selected == _EvalTab.voice,
            onTap: onSelectVoice,
          ),
        ),
      ],
    );
  }
}

class _EvalPill extends StatelessWidget {
  const _EvalPill({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bg = selected ? const Color(0xFFFFF8E1) : Colors.white;
    final fg = selected ? const Color(0xFF5D4037) : const Color(0xFF6B7280);
    final border = selected ? const Color(0xFFF59E0B) : const Color(0xFFD7CCC8);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: border, width: selected ? 1.5 : 1),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: fg),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                    color: fg,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScoreHeader extends StatelessWidget {
  const _ScoreHeader({
    required this.displayTotal,
    this.answerScore,
    this.voiceScore,
  });

  final double? displayTotal;
  final double? answerScore;
  final double? voiceScore;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.analytics_rounded, color: Color(0xFFF59E0B), size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '전체 점수',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  formatAiScoreFraction(displayTotal),
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFFFFA000),
                  ),
                ),
                if (answerScore != null || voiceScore != null) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      const Text(
                        '답변 분석 ',
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      Text(
                        formatAiScoreFraction(answerScore),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF374151),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Text(
                        '음성 평가 ',
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      Text(
                        formatAiScoreFraction(voiceScore),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF374151),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SubScores extends StatelessWidget {
  const _SubScores({required this.scores});

  final Map<String, dynamic> scores;

  @override
  Widget build(BuildContext context) {
    final entries = scores.entries.toList();
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: entries.map((e) {
        final label = labelForSubScoreKey(e.key);
        final raw = (e.value as num?)?.toDouble();
        final val = formatAiScoreFraction(raw);
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF8E1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFFE082).withValues(alpha: 0.5)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                val,
                style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  color: Color(0xFF4E342E),
                ),
              ),
              Text(
                label,
                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _BulletSection extends StatelessWidget {
  const _BulletSection({required this.title, required this.items});

  final String title;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 8),
          ...items.map(
            (s) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '• ',
                    style: TextStyle(
                      color: Color(0xFFF59E0B),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  Expanded(
                    child: SelectableText(
                      s,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: Color(0xFF374151),
                      ),
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
