import '../services/interview_record_db.dart';

double? _numFromDynamic(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

double? totalScoreFromAnswerEvaluationMap(Map<String, dynamic>? m) {
  if (m == null) return null;
  return _numFromDynamic(m['totalScore']);
}

double? overallScoreFromVoiceEvaluationMap(Map<String, dynamic>? m) {
  if (m == null) return null;
  return _numFromDynamic(m['overallScore']);
}

/// 면접 준비 피드백 단계와 동일: 답변 평균·음성 평균이 모두 있으면 (a+b)/2, 하나만 있으면 그 값.
double? combinedAnswerVoiceAverage(double? answerAvg, double? voiceAvg) {
  if (answerAvg != null && voiceAvg != null) return (answerAvg + voiceAvg) / 2;
  if (answerAvg != null) return answerAvg;
  if (voiceAvg != null) return voiceAvg;
  return null;
}

double? meanAnswerScoreForItems(List<InterviewItemRow> items) {
  final scores = items
      .map((e) => totalScoreFromAnswerEvaluationMap(
            interviewItemAnswerEvaluationMap(e),
          ))
      .whereType<double>()
      .toList();
  if (scores.isEmpty) return null;
  return scores.reduce((a, b) => a + b) / scores.length;
}

double? meanVoiceScoreForItems(List<InterviewItemRow> items) {
  final scores = items
      .map((e) => overallScoreFromVoiceEvaluationMap(
            interviewItemVoiceEvaluationMap(e),
          ))
      .whereType<double>()
      .toList();
  if (scores.isEmpty) return null;
  return scores.reduce((a, b) => a + b) / scores.length;
}
