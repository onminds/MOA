import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// 로그인 온보딩에서 입력·수정한 회사 분석 스냅샷을 저장해
/// [InterviewPrepPage]의 `generate-questions` 등에 동일 데이터를 쓰기 위한 캐시.
class InterviewPrepSetupSnapshot {
  const InterviewPrepSetupSnapshot({
    required this.companyName,
    required this.jobTitle,
    required this.experienceLevel,
    required this.skills,
    required this.jobDescription,
    required this.experience,
    required this.companyAnalysis,
  });

  final String companyName;
  final String jobTitle;
  /// 경력 수준: `junior` | `mid` | `senior` (면접 준비 화면 `careerLevel`과 동일)
  final String experienceLevel;
  final String skills;
  /// 직무 설명 (채용공고 요약 등, 선택)
  final String jobDescription;
  /// 주요 경험 및 프로젝트
  final String experience;
  final Map<String, dynamic> companyAnalysis;
}

class InterviewPrepSetupCache {
  InterviewPrepSetupCache._();

  static const String _prefix = 'interview_prep_setup_cache_v1_';

  static String _key(String? userId) => '$_prefix${userId ?? 'guest'}';

  /// API/저장소에서 온 맵을 UI·JSON 양쪽에서 안전하게 쓰도록 정규화합니다.
  static Map<String, dynamic> normalizeCompanyAnalysis(
    Map<String, dynamic> raw,
  ) {
    List<String> asStringList(dynamic v) {
      if (v is! List) return <String>[];
      return v
          .map((e) => e.toString().trim())
          .where((e) => e.isNotEmpty)
          .toList();
    }

    return <String, dynamic>{
      'coreValues': asStringList(raw['coreValues']),
      'idealCandidate': raw['idealCandidate']?.toString() ?? '',
      'vision': raw['vision']?.toString() ?? '',
      'companyCulture': raw['companyCulture']?.toString() ?? '',
      'businessAreas': asStringList(raw['businessAreas']),
      'keyCompetencies': asStringList(raw['keyCompetencies']),
      if (raw['originalCompanyName'] != null)
        'originalCompanyName': raw['originalCompanyName'].toString(),
    };
  }

  static Future<void> save(
    String? userId, {
    required String companyName,
    required String jobTitle,
    required String experienceLevel,
    required String skills,
    required String jobDescription,
    required String experience,
    required Map<String, dynamic> companyAnalysis,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final merged = Map<String, dynamic>.from(companyAnalysis);
    if (companyName.isNotEmpty) {
      merged['originalCompanyName'] = companyName;
    }
    final normalized = normalizeCompanyAnalysis(merged);
    final payload = <String, dynamic>{
      'companyName': companyName,
      'jobTitle': jobTitle,
      'experienceLevel': experienceLevel,
      'skills': skills,
      'jobDescription': jobDescription,
      'experience': experience,
      'companyAnalysis': normalized,
    };
    await prefs.setString(_key(userId), jsonEncode(payload));
  }

  static Future<InterviewPrepSetupSnapshot?> load(String? userId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(userId));
    if (raw == null || raw.isEmpty) return null;
    try {
      final map = jsonDecode(raw) as Map<String, dynamic>;
      final ca = map['companyAnalysis'];
      if (ca is! Map) return null;
      final analysisMap = Map<String, dynamic>.from(ca);
      return InterviewPrepSetupSnapshot(
        companyName: map['companyName']?.toString() ?? '',
        jobTitle: map['jobTitle']?.toString() ?? '',
        experienceLevel: map['experienceLevel']?.toString() ?? '',
        skills: map['skills']?.toString() ?? '',
        jobDescription: map['jobDescription']?.toString() ?? '',
        experience: map['experience']?.toString() ?? '',
        companyAnalysis: normalizeCompanyAnalysis(analysisMap),
      );
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear(String? userId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(userId));
  }
}
