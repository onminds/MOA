import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// AdMob 앱·광고 단위 ID.
///
/// 배포 시 `--dart-define=ADMOB_APP_ID_ANDROID=...` 등으로 실제 값을 넘기거나,
/// 아래 기본값을 프로젝트에 맞게 수정하세요.
///
/// Android·iOS 기본값은 부엉 스피치 프로덕션(AdMob) ID입니다.
class AdmobConfig {
  AdmobConfig._();

  /// Android 앱 ID (`AndroidManifest`의 APPLICATION_ID와 동일 권장)
  static const String appIdAndroid = String.fromEnvironment(
    'ADMOB_APP_ID_ANDROID',
    defaultValue: 'ca-app-pub-1281817666797581~5277489431',
  );

  /// iOS 앱 ID (`Info.plist` GADApplicationIdentifier와 동일 권장)
  static const String appIdIos = String.fromEnvironment(
    'ADMOB_APP_ID_IOS',
    defaultValue: 'ca-app-pub-1281817666797581~5603847947',
  );

  static const String rewardedAndroid = String.fromEnvironment(
    'ADMOB_REWARDED_ANDROID',
    defaultValue: 'ca-app-pub-1281817666797581/7135901944',
  );

  static const String rewardedIos = String.fromEnvironment(
    'ADMOB_REWARDED_IOS',
    defaultValue: 'ca-app-pub-1281817666797581/5411756734',
  );

  /// 홈 화면 네이티브 광고 단위 ID.
  /// AdMob 콘솔 > 광고 단위에서 "네이티브" 타입으로 생성한 뒤 실제 ID로 교체하세요.
  /// 현재는 Google 공식 테스트 ID가 기본값으로 설정되어 있습니다.
  static const String nativeAndroid = String.fromEnvironment(
    'ADMOB_NATIVE_ANDROID',
    defaultValue: 'ca-app-pub-1281817666797581/5628041861',
  );

  static const String nativeIos = String.fromEnvironment(
    'ADMOB_NATIVE_IOS',
    defaultValue: 'ca-app-pub-1281817666797581/4496976330',
  );

  static bool get supportedPlatform =>
      !kIsWeb && (Platform.isAndroid || Platform.isIOS);

  static String get rewardedUnitId {
    if (kIsWeb) return rewardedAndroid;
    if (Platform.isIOS) return rewardedIos;
    return rewardedAndroid;
  }

  static String get nativeUnitId {
    if (kIsWeb) return nativeAndroid;
    if (Platform.isIOS) return nativeIos;
    return nativeAndroid;
  }

  /// 면접 완료 화면 네이티브 광고 단위 ID.
  static const String resultNativeAndroid = String.fromEnvironment(
    'ADMOB_RESULT_NATIVE_ANDROID',
    defaultValue: 'ca-app-pub-1281817666797581/1491539048',
  );

  static const String resultNativeIos = String.fromEnvironment(
    'ADMOB_RESULT_NATIVE_IOS',
    defaultValue: 'ca-app-pub-1281817666797581/1060294208',
  );

  static String get resultNativeUnitId {
    if (kIsWeb) return resultNativeAndroid;
    if (Platform.isIOS) return resultNativeIos;
    return resultNativeAndroid;
  }

  /// 기록 탭 커스텀 네이티브 광고 단위 ID (Google 테스트 ID 기본값)
  /// 실제 배포 전 AdMob 콘솔 > 광고 단위 > 네이티브에서 발급한 ID로 교체하세요.
  static const String recordNativeAndroid = String.fromEnvironment(
    'ADMOB_RECORD_NATIVE_ANDROID',
    defaultValue: 'ca-app-pub-1281817666797581/2445528068',
  );

  static const String recordNativeIos = String.fromEnvironment(
    'ADMOB_RECORD_NATIVE_IOS',
    defaultValue: 'ca-app-pub-1281817666797581/9940874709',
  );

  static String get recordNativeUnitId {
    if (kIsWeb) return recordNativeAndroid;
    if (Platform.isIOS) return recordNativeIos;
    return recordNativeAndroid;
  }
}
