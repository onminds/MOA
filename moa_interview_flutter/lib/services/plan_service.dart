import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'auth_service.dart';

class PlanException implements Exception {
  PlanException(this.message);

  final String message;

  @override
  String toString() => message;
}

class PlanDetails {
  const PlanDetails({
    required this.planType,
    required this.displayName,
    required this.name,
    this.features = const <String>[],
  });

  factory PlanDetails.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic>? planInfo =
        json['planInfo'] as Map<String, dynamic>?;
    final String type = (json['planType'] as String? ?? 'basic').toLowerCase();

    final List<String> features = <String>[];
    final dynamic rawFeatures = planInfo?['features'];
    if (rawFeatures is Iterable) {
      for (final item in rawFeatures) {
        if (item is String) {
          features.add(item);
        }
      }
    }

    final String displayName =
        planInfo?['displayName'] as String? ?? _fallbackDisplayName(type);

    return PlanDetails(
      planType: type,
      displayName: displayName,
      name: planInfo?['name'] as String? ?? displayName,
      features: features,
    );
  }

  final String planType;
  final String displayName;
  final String name;
  final List<String> features;

  static String _fallbackDisplayName(String type) {
    switch (type) {
      case 'standard':
        return 'Standard';
      case 'pro':
        return 'Pro';
      default:
        return 'Basic';
    }
  }
}

class PlanService {
  PlanService._internal();

  static final PlanService instance = PlanService._internal();

  final Dio _dio = AuthService.instance.client;

  Future<PlanDetails> fetchPlan() async {
    try {
      // 로그인 확인
      await AuthService.instance.restoreSession();
      if (!AuthService.instance.isLoggedIn) {
        debugPrint('[PlanService] 비로그인 상태, 기본 플랜 반환');
        return const PlanDetails(
          planType: 'basic',
          displayName: 'Basic Plan',
          name: 'Basic',
        );
      }

      debugPrint('[PlanService] 플랜 조회 API 호출: /api/mobile/user/plan');
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/mobile/user/plan',
      );
      debugPrint('[PlanService] 응답 상태: ${response.statusCode}');
      final data = response.data;
      if (data == null) {
        debugPrint('[PlanService] 응답 데이터가 null');
        throw PlanException('플랜 정보를 불러오지 못했습니다.');
      }
      debugPrint('[PlanService] 플랜 데이터: $data');
      return PlanDetails.fromJson(data);
    } on DioException catch (error) {
      debugPrint('[PlanService] DioException: ${error.type}, statusCode: ${error.response?.statusCode}');
      debugPrint('[PlanService] 응답 데이터: ${error.response?.data}');
      debugPrint('[PlanService] 에러 메시지: ${error.message}');
      
      final dynamic responseData = error.response?.data;
      final String message =
          responseData is Map && responseData['error'] is String
              ? responseData['error'] as String
              : '플랜 정보를 불러오는 중 문제가 발생했습니다. (${error.response?.statusCode ?? error.type})';
      throw PlanException(message);
    } catch (error) {
      debugPrint('[PlanService] 일반 오류: $error');
      throw PlanException('플랜 정보를 불러오는 중 문제가 발생했습니다.');
    }
  }
}
