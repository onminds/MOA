import 'package:flutter/material.dart';

import '../services/interview_record_db.dart';
import '../utils/interview_score_display.dart';
import '../utils/interview_session_scores.dart';
import 'interview_question_analysis_page.dart';

/// 한 세션의 답변 요약 목록 — Qn 탭 시 AI 분석 전체 화면
class InterviewRecordDetailPage extends StatefulWidget {
  const InterviewRecordDetailPage({super.key, required this.sessionId});

  final int sessionId;

  @override
  State<InterviewRecordDetailPage> createState() => _InterviewRecordDetailPageState();
}

class _InterviewRecordDetailPageState extends State<InterviewRecordDetailPage> {
  Future<_DetailBundle>? _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    setState(() {
      _future = _fetch();
    });
  }

  Future<_DetailBundle> _fetch() async {
    final db = InterviewRecordDb.instance;
    final session = await db.getSession(widget.sessionId);
    final items = await db.listItems(widget.sessionId);
    return _DetailBundle(session: session, items: items);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFFFDFBF7),
        foregroundColor: const Color(0xFF5D4037),
        title: const Text(
          '답변 요약',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        centerTitle: true,
      ),
      body: FutureBuilder<_DetailBundle>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFF8D6E63)));
          }
          if (snap.hasError || snap.data?.session == null) {
            return const Center(child: Text('기록을 불러올 수 없습니다.'));
          }
          final bundle = snap.data!;
          final session = bundle.session!;
          final items = bundle.items;
          final answerAvg = meanAnswerScoreForItems(items);
          final voiceAvg = meanVoiceScoreForItems(items);
          final combinedFromItems =
              combinedAnswerVoiceAverage(answerAvg, voiceAvg);
          final displayTotal = combinedFromItems ?? session.avgScore;
          final hasAnyScore = displayTotal != null ||
              answerAvg != null ||
              voiceAvg != null;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (hasAnyScore)
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.star_rounded,
                                color: Color(0xFFF59E0B), size: 28),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    '전체 점수',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF6B7280),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    formatAiScoreFraction(displayTotal),
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF111827),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                if (hasAnyScore) const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '답변 요약',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ...items.asMap().entries.map((e) {
                        final index = e.key;
                        final q = e.value;
                        final preview = q.answer != null && q.answer!.trim().isNotEmpty
                            ? (q.answer!.length > 100 ? '${q.answer!.substring(0, 100)}…' : q.answer!)
                            : '답변이 작성되지 않았습니다.';
                        return Padding(
                          padding: EdgeInsets.only(bottom: index < items.length - 1 ? 16 : 0),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: () {
                                Navigator.of(context).push<void>(
                                  MaterialPageRoute<void>(
                                    builder: (_) => InterviewQuestionAnalysisPage(
                                      session: session,
                                      item: q,
                                      questionLabel: 'Q${index + 1}',
                                    ),
                                  ),
                                );
                              },
                              borderRadius: BorderRadius.circular(8),
                              child: Padding(
                                padding: const EdgeInsets.only(left: 14, top: 4, bottom: 4),
                                child: Container(
                                  padding: const EdgeInsets.only(left: 12),
                                  decoration: const BoxDecoration(
                                    border: Border(
                                      left: BorderSide(color: Color(0xFFF59E0B), width: 4),
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Text(
                                              'Q${index + 1}. ${q.question}',
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFF111827),
                                              ),
                                            ),
                                          ),
                                          const Icon(Icons.chevron_right_rounded, color: Color(0xFFBCAAA4)),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        preview,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: Color(0xFF6B7280),
                                          height: 1.4,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _DetailBundle {
  _DetailBundle({required this.session, required this.items});

  final InterviewSessionRow? session;
  final List<InterviewItemRow> items;
}
