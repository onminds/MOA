import 'package:flutter/material.dart';

import '../services/interview_record_db.dart';
import '../utils/interview_score_display.dart';
import 'interview_question_voice_analysis_page.dart';

/// 세션에 저장된 질문별 음성 평가를 한 화면에서 나열
class InterviewSessionVoiceSummaryPage extends StatelessWidget {
  const InterviewSessionVoiceSummaryPage({
    super.key,
    required this.session,
    required this.items,
  });

  final InterviewSessionRow session;
  final List<InterviewItemRow> items;

  @override
  Widget build(BuildContext context) {
    final withVoice = items
        .asMap()
        .entries
        .where((e) => interviewItemVoiceEvaluationMap(e.value) != null)
        .toList();

    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFFFDFBF7),
        foregroundColor: const Color(0xFF5D4037),
        title: const Text(
          '음성 평가',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        centerTitle: true,
      ),
      body: withVoice.isEmpty
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  '저장된 음성 평가가 없습니다.\n면접 준비에서 녹음 후 AI 피드백을 받으면 이곳에 표시됩니다.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF6B7280), height: 1.5),
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  '${session.companyName} · ${session.jobTitle}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(height: 16),
                ...withVoice.map((e) {
                  final index = e.key;
                  final q = e.value;
                  final voice = interviewItemVoiceEvaluationMap(q)!;
                  final label = 'Q${index + 1}';
                  final overall = (voice['overallScore'] as num?)?.toDouble();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      elevation: 0,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: () {
                          Navigator.of(context).push<void>(
                            MaterialPageRoute<void>(
                              builder: (_) => InterviewQuestionVoiceAnalysisPage(
                                session: session,
                                item: q,
                                questionLabel: label,
                              ),
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
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
                                  Expanded(
                                    child: Text(
                                      '$label. ${q.question}',
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFF111827),
                                        height: 1.35,
                                      ),
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right_rounded,
                                      color: Color(0xFFBCAAA4)),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                formatAiScoreFraction(overall),
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFFFFA000),
                                ),
                              ),
                              const SizedBox(height: 4),
                              const Text(
                                '음성 점수 · 탭하면 상세 보기',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF6B7280),
                                ),
                              ),
                            ],
                          ),
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
