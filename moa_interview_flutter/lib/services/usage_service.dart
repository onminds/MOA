import 'package:dio/dio.dart';

import 'auth_service.dart';

class UsageInfo {
  const UsageInfo({
    required this.serviceType,
    required this.usageCount,
    required this.limitCount,
    required this.remainingCount,
    required this.planType,
    required this.allowed,
    this.resetDate,
  });

  final String serviceType;
  final int usageCount;
  final int limitCount;
  final int remainingCount;
  final String planType;
  final bool allowed;
  final DateTime? resetDate;

  factory UsageInfo.fromJson(String serviceType, Map<String, dynamic> json) {
    return UsageInfo(
      serviceType: serviceType,
      usageCount: _parseInt(json['usageCount']),
      limitCount: _parseInt(json['limitCount']),
      remainingCount: _parseInt(json['remainingCount']),
      planType: (json['planType'] ?? 'basic') as String,
      allowed: json['allowed'] is bool ? json['allowed'] as bool : true,
      resetDate: json['resetDate'] != null
          ? DateTime.tryParse(json['resetDate'] as String)
          : null,
    );
  }

  static int _parseInt(dynamic value) {
    if (value is int) return value;
    if (value is double) return value.round();
    if (value is num) return value.toInt();
    if (value is String) {
      return double.tryParse(value)?.round() ?? int.tryParse(value) ?? 0;
    }
    return 0;
  }
}

class UsageService {
  UsageService._();

  static final UsageService instance = UsageService._();

  final AuthService _authService = AuthService.instance;

  Future<UsageInfo> fetchUsage(String serviceType) async {
    if (!_authService.isLoggedIn) {
      throw Exception('로그인이 필요합니다.');
    }

    try {
      final Response<Map<String, dynamic>> response =
          await _authService.client.get(
        '/api/mobile/usage/check',
        queryParameters: {'serviceType': serviceType},
      );

      final data = response.data;
      if (data == null) {
        throw Exception('사용량 정보를 불러오지 못했습니다.');
      }

      if (data.containsKey('error')) {
        throw Exception(data['error']?.toString() ?? '사용량 조회에 실패했습니다.');
      }

      return UsageInfo.fromJson(serviceType, data);
    } on DioException catch (error) {
      final message = error.response?.data is Map
          ? (error.response?.data['error']?.toString() ?? '')
          : '';
      throw Exception(message.isNotEmpty
          ? message
          : '사용량 조회 중 오류가 발생했습니다.');
    }
  }
}
