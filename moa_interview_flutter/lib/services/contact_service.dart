import 'package:dio/dio.dart';

import 'auth_service.dart';

class ContactException implements Exception {
  ContactException(this.message);

  final String message;

  @override
  String toString() => message;
}

class ContactService {
  ContactService._internal();

  static final ContactService instance = ContactService._internal();

  final Dio _dio = AuthService.instance.client;

  Future<void> submitInquiry({
    required String name,
    required String email,
    required String subject,
    required String message,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/contact',
        data: <String, dynamic>{
          'name': name,
          'email': email,
          'subject': subject,
          'message': message,
        },
      );

      if (response.statusCode != 200) {
        final data = response.data;
        final errorMessage =
            data is Map<String, dynamic> && data['message'] is String
                ? data['message'] as String
                : '문의 전송에 실패했습니다.';
        throw ContactException(errorMessage);
      }
    } on DioException catch (error) {
      final data = error.response?.data;
      final errorMessage =
          data is Map<String, dynamic> && data['message'] is String
              ? data['message'] as String
              : '문의 전송 중 오류가 발생했습니다.';
      throw ContactException(errorMessage);
    } catch (_) {
      throw ContactException('문의 전송 중 알 수 없는 오류가 발생했습니다.');
    }
  }
}
