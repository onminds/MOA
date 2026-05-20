import 'package:shared_preferences/shared_preferences.dart';

/// Apple 5.1.1/5.1.2: 제3자 AI로의 개인정보 전송·처리에 대한 인앱 동의 저장.
/// [login_page] 약관/AI 동의 모달에서만 설정한다.
class AiDataConsent {
  static const _key = 'ai_third_party_data_consent_v1';

  static Future<bool> isAccepted() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_key) ?? false;
  }

  static Future<void> setAccepted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, true);
  }
}
