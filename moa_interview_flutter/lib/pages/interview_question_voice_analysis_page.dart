import 'package:flutter/material.dart';

import '../services/interview_record_db.dart';
import '../widgets/interview_voice_evaluation_body.dart';

/// 기록에서 한 질문의 저장된 음성 평가 전체
class InterviewQuestionVoiceAnalysisPage extends StatelessWidget {
  const InterviewQuestionVoiceAnalysisPage({
    super.key,
    required this.session,
    required this.item,
    required this.questionLabel,
  });

  final InterviewSessionRow session;
  final InterviewItemRow item;
  final String questionLabel;

  @override
  Widget build(BuildContext context) {
    final voice = interviewItemVoiceEvaluationMap(item);

    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFFFDFBF7),
        foregroundColor: const Color(0xFF5D4037),
        title: Text(
          '$questionLabel 음성 평가',
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
              '${session.companyName} · ${session.jobTitle}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF6B7280),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '$questionLabel. ${item.question}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Color(0xFF111827),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            if (voice == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Text(
                  '이 질문에 대한 음성 평가가 저장되지 않았습니다.\n(텍스트만 입력했거나 음성 분석 전에 종료한 경우)',
                  style: TextStyle(color: Color(0xFF6B7280), height: 1.5),
                ),
              )
            else
              InterviewVoiceEvaluationBody(voice: voice),
          ],
        ),
      ),
    );
  }
}
