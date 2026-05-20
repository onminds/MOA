import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../services/interview_record_db.dart';
import 'records_aggregate_score_page.dart';

/// 하단 '내점수' 탭 — [RecordsAggregateScorePage]와 동일 데이터(세션 평균·항목별 평균)
class MyScoreTabPage extends StatefulWidget {
  const MyScoreTabPage({super.key});

  @override
  MyScoreTabPageState createState() => MyScoreTabPageState();
}

class _MyScoreData {
  const _MyScoreData({
    required this.overallAvg,
    required this.subScoreAvgs,
  });

  final double? overallAvg;
  final Map<String, double> subScoreAvgs;

  static const empty = _MyScoreData(
    overallAvg: null,
    subScoreAvgs: <String, double>{},
  );
}

class MyScoreTabPageState extends State<MyScoreTabPage> {
  final _auth = AuthService.instance;
  Future<_MyScoreData>? _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void reassemble() {
    super.reassemble();
    _reload();
  }

  Future<_MyScoreData> _load() async {
    final uid = _auth.currentUser?.id;
    final db = InterviewRecordDb.instance;
    final sessions = await db.listSessions(userId: uid);
    final subScoreAvgs = await db.averageSubScoresFromEvaluations(userId: uid);
    final overallAvg = _overallAverageScore(sessions);
    return _MyScoreData(overallAvg: overallAvg, subScoreAvgs: subScoreAvgs);
  }

  /// [RecordsTabPage]와 동일: 저장된 세션 [avg_score] 산술 평균
  double? _overallAverageScore(List<InterviewSessionRow> rows) {
    final scores =
        rows.where((r) => r.avgScore != null).map((r) => r.avgScore!).toList();
    if (scores.isEmpty) return null;
    return scores.reduce((a, b) => a + b) / scores.length;
  }

  Future<void> _reload() async {
    final Future<_MyScoreData> f = _load();
    setState(() => _future = f);
    await f;
  }

  /// [HomePage]에서 탭 선택 시 최신 기록 반영
  void refresh() => _reload();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<_MyScoreData>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: Color(0xFFFDFBF7),
            body: Center(
              child: CircularProgressIndicator(color: Color(0xFF8D6E63)),
            ),
          );
        }
        if (snap.hasError) {
          return Scaffold(
            backgroundColor: const Color(0xFFFDFBF7),
            appBar: AppBar(
              elevation: 0,
              backgroundColor: const Color(0xFFFDFBF7),
              foregroundColor: const Color(0xFF5D4037),
              title: const Text(
                '내 점수',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
              ),
              centerTitle: true,
            ),
            body: Center(child: Text('불러오기 실패: ${snap.error}')),
          );
        }
        final data = snap.data ?? _MyScoreData.empty;
        return RecordsAggregateScorePage(
          overallAvg: data.overallAvg,
          subScoreAvgs: data.subScoreAvgs,
        );
      },
    );
  }
}
