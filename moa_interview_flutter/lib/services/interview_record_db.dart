import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

/// 부엉 스피치 앱 **로컬 전용** 면접 기록 DB. 서버/웹(moa.tools Next)과 분리되어 기존 MOA에 영향 없음.
class InterviewRecordDb {
  InterviewRecordDb._();
  static final InterviewRecordDb instance = InterviewRecordDb._();

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    final dir = await getApplicationDocumentsDirectory();
    final path = p.join(dir.path, 'interview_records.db');
    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('PRAGMA foreign_keys = ON');
        await db.execute('''
          CREATE TABLE interview_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            company_name TEXT NOT NULL,
            job_title TEXT NOT NULL,
            created_at_ms INTEGER NOT NULL,
            avg_score REAL,
            first_question TEXT NOT NULL,
            question_count INTEGER NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE interview_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            sort_order INTEGER NOT NULL,
            server_question_id INTEGER,
            category TEXT,
            question TEXT NOT NULL,
            difficulty TEXT,
            tips_json TEXT,
            answer TEXT,
            feedback TEXT,
            score INTEGER,
            evaluation_json TEXT,
            FOREIGN KEY (session_id) REFERENCES interview_sessions (id) ON DELETE CASCADE
          )
        ''');
        await db.execute(
          'CREATE INDEX idx_items_session ON interview_items (session_id)',
        );
      },
    );
    return _db!;
  }

  /// 면접 피드백 단계 진입 시 1회 저장
  Future<int> insertSession({
    String? userId,
    required String companyName,
    required String jobTitle,
    required double avgScore,
    required String firstQuestion,
    required List<InterviewQuestionPayload> questions,
  }) async {
    final db = await database;
    final now = DateTime.now().millisecondsSinceEpoch;
    return db.transaction((txn) async {
      final sessionId = await txn.insert('interview_sessions', {
        'user_id': userId,
        'company_name': companyName,
        'job_title': jobTitle,
        'created_at_ms': now,
        'avg_score': avgScore,
        'first_question': firstQuestion,
        'question_count': questions.length,
      });
      for (var i = 0; i < questions.length; i++) {
        final q = questions[i];
        await txn.insert('interview_items', {
          'session_id': sessionId,
          'sort_order': i,
          'server_question_id': q.serverQuestionId,
          'category': q.category,
          'question': q.question,
          'difficulty': q.difficulty,
          'tips_json': jsonEncode(q.tips),
          'answer': q.answer,
          'feedback': q.feedback,
          'score': q.score,
          'evaluation_json': () {
            final e = q.evaluation;
            final v = q.voiceEvaluation;
            if (e == null && v == null) return null;
            final merged = <String, dynamic>{
              if (e != null) ...e,
              if (v != null) 'voiceEvaluation': v,
            };
            return jsonEncode(merged);
          }(),
        });
      }
      return sessionId;
    });
  }

  Future<List<InterviewSessionRow>> listSessions({String? userId}) async {
    final db = await database;
    // 동일 기기 로컬 DB — userId 있으면 해당 사용자·구버전(null) 행 모두 표시
    final List<Map<String, Object?>> rows;
    if (userId != null && userId.isNotEmpty) {
      rows = await db.query(
        'interview_sessions',
        where: 'user_id = ? OR user_id IS NULL',
        whereArgs: [userId],
        orderBy: 'created_at_ms DESC',
      );
    } else {
      rows = await db.query(
        'interview_sessions',
        orderBy: 'created_at_ms DESC',
      );
    }
    return rows.map(InterviewSessionRow.fromMap).toList();
  }

  Future<InterviewSessionRow?> getSession(int id) async {
    final db = await database;
    final rows = await db.query(
      'interview_sessions',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return InterviewSessionRow.fromMap(rows.first);
  }

  Future<List<InterviewItemRow>> listItems(int sessionId) async {
    final db = await database;
    final rows = await db.query(
      'interview_items',
      where: 'session_id = ?',
      whereArgs: [sessionId],
      orderBy: 'sort_order ASC',
    );
    return rows.map(InterviewItemRow.fromMap).toList();
  }

  Future<void> deleteSession(int id) async {
    final db = await database;
    await db.delete('interview_sessions', where: 'id = ?', whereArgs: [id]);
  }

  /// 모든 면접 기록 항목의 [evaluation_json] 안 `scores` 항목별 산술 평균.
  /// [listSessions]와 동일한 [userId] 필터.
  Future<Map<String, double>> averageSubScoresFromEvaluations({String? userId}) async {
    final db = await database;
    final List<Map<String, Object?>> rows;
    if (userId != null && userId.isNotEmpty) {
      rows = await db.rawQuery('''
        SELECT i.evaluation_json AS evaluation_json
        FROM interview_items i
        INNER JOIN interview_sessions s ON s.id = i.session_id
        WHERE (s.user_id = ? OR s.user_id IS NULL) AND i.evaluation_json IS NOT NULL
      ''', [userId]);
    } else {
      rows = await db.rawQuery('''
        SELECT evaluation_json AS evaluation_json
        FROM interview_items
        WHERE evaluation_json IS NOT NULL
      ''');
    }

    final sums = <String, double>{};
    final counts = <String, int>{};

    for (final row in rows) {
      final raw = row['evaluation_json'] as String?;
      if (raw == null || raw.trim().isEmpty) continue;
      Map<String, dynamic> ev;
      try {
        ev = jsonDecode(raw) as Map<String, dynamic>;
      } catch (_) {
        continue;
      }
      ev.remove('voiceEvaluation');
      final scores = ev['scores'];
      if (scores is! Map) continue;
      scores.forEach((k, v) {
        final key = k.toString();
        final num? n = v is num ? v : num.tryParse(v.toString());
        if (n == null) return;
        sums[key] = (sums[key] ?? 0) + n.toDouble();
        counts[key] = (counts[key] ?? 0) + 1;
      });
    }

    final out = <String, double>{};
    sums.forEach((k, sum) {
      final c = counts[k];
      if (c != null && c > 0) {
        out[k] = sum / c;
      }
    });
    return out;
  }
}

/// [InterviewPrepPage]에서 세션 저장 시 전달하는 DTO (페이지 import 순환 방지)
class InterviewQuestionPayload {
  const InterviewQuestionPayload({
    required this.serverQuestionId,
    required this.category,
    required this.question,
    required this.difficulty,
    required this.tips,
    this.answer,
    this.feedback,
    this.score,
    this.evaluation,
    this.voiceEvaluation,
  });

  final int serverQuestionId;
  final String category;
  final String question;
  final String difficulty;
  final List<String> tips;
  final String? answer;
  final String? feedback;
  final int? score;
  final Map<String, dynamic>? evaluation;
  final Map<String, dynamic>? voiceEvaluation;
}

class InterviewSessionRow {
  InterviewSessionRow({
    required this.id,
    required this.userId,
    required this.companyName,
    required this.jobTitle,
    required this.createdAtMs,
    required this.avgScore,
    required this.firstQuestion,
    required this.questionCount,
  });

  final int id;
  final String? userId;
  final String companyName;
  final String jobTitle;
  final int createdAtMs;
  final double? avgScore;
  final String firstQuestion;
  final int questionCount;

  factory InterviewSessionRow.fromMap(Map<String, Object?> m) {
    return InterviewSessionRow(
      id: m['id']! as int,
      userId: m['user_id'] as String?,
      companyName: m['company_name'] as String? ?? '',
      jobTitle: m['job_title'] as String? ?? '',
      createdAtMs: m['created_at_ms'] as int? ?? 0,
      avgScore: (m['avg_score'] as num?)?.toDouble(),
      firstQuestion: m['first_question'] as String? ?? '',
      questionCount: m['question_count'] as int? ?? 0,
    );
  }
}

class InterviewItemRow {
  InterviewItemRow({
    required this.id,
    required this.sessionId,
    required this.sortOrder,
    required this.serverQuestionId,
    required this.category,
    required this.question,
    required this.difficulty,
    required this.tipsJson,
    required this.answer,
    required this.feedback,
    required this.score,
    required this.evaluationJson,
  });

  final int id;
  final int sessionId;
  final int sortOrder;
  final int? serverQuestionId;
  final String? category;
  final String question;
  final String? difficulty;
  final String? tipsJson;
  final String? answer;
  final String? feedback;
  final int? score;
  final String? evaluationJson;

  Map<String, dynamic>? get evaluationMap {
    final raw = evaluationJson;
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  factory InterviewItemRow.fromMap(Map<String, Object?> m) {
    return InterviewItemRow(
      id: m['id']! as int,
      sessionId: m['session_id']! as int,
      sortOrder: m['sort_order'] as int? ?? 0,
      serverQuestionId: m['server_question_id'] as int?,
      category: m['category'] as String?,
      question: m['question'] as String? ?? '',
      difficulty: m['difficulty'] as String?,
      tipsJson: m['tips_json'] as String?,
      answer: m['answer'] as String?,
      feedback: m['feedback'] as String?,
      score: m['score'] as int?,
      evaluationJson: m['evaluation_json'] as String?,
    );
  }
}

/// [insertSession] 시 병합된 [evaluation_json]에서 답변(텍스트) 평가만 — `voiceEvaluation` 키 제외.
Map<String, dynamic>? interviewItemAnswerEvaluationMap(InterviewItemRow row) {
  final m = row.evaluationMap;
  if (m == null) return null;
  final copy = Map<String, dynamic>.from(m)..remove('voiceEvaluation');
  if (copy.isEmpty) return null;
  return copy;
}

/// `evaluate-voice` 응답이 [evaluation_json]에 `voiceEvaluation`으로 중첩 저장된 경우.
Map<String, dynamic>? interviewItemVoiceEvaluationMap(InterviewItemRow row) {
  final m = row.evaluationMap;
  if (m == null) return null;
  final v = m['voiceEvaluation'];
  if (v is Map<String, dynamic>) return Map<String, dynamic>.from(v);
  if (v is Map) return Map<String, dynamic>.from(v);
  return null;
}
