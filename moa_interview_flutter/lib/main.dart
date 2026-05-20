import 'dart:io';

import 'package:app_tracking_transparency/app_tracking_transparency.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:kakao_flutter_sdk_user/kakao_flutter_sdk_user.dart';

import 'interview_root.dart';
import 'services/auth_service.dart';
import 'services/push_notification_service.dart';
import 'services/analytics_service.dart';

/// MOA 전체 앱(`moa_flutter/lib/main.dart`)에서 복사한 부트스트랩.
/// 홈만 `InterviewRoot`로 교체함.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // iOS: request ATT before initializing ad SDK (tracking-related data).
  if (!kIsWeb && Platform.isIOS) {
    try {
      final status = await AppTrackingTransparency.trackingAuthorizationStatus;
      if (status == TrackingStatus.notDetermined) {
        await Future<void>.delayed(const Duration(milliseconds: 400));
        await AppTrackingTransparency.requestTrackingAuthorization();
      }
    } catch (e) {
      debugPrint('ATT request failed: $e');
    }
  }

  if (!kIsWeb &&
      (Platform.isAndroid || Platform.isIOS)) {
    try {
      await MobileAds.instance.initialize();
    } catch (e) {
      debugPrint('❌ MobileAds 초기화 실패: $e');
    }
  }

  try {
    await Firebase.initializeApp().timeout(const Duration(seconds: 10));
  } catch (e) {
    debugPrint('❌ Firebase 초기화 실패: $e');
  }

  AnalyticsService.instance
      .initialize()
      .timeout(const Duration(seconds: 5))
      .catchError((e) {
        debugPrint('❌ Analytics 초기화 실패: $e');
      });

  try {
    await AuthService.instance.restoreSession().timeout(
      const Duration(seconds: 5),
    );
  } catch (e) {
    debugPrint('❌ 세션 복원 실패: $e');
  }

  AuthService.instance
      .refreshProfile()
      .timeout(const Duration(seconds: 8))
      .catchError((e) {
        debugPrint('❌ 프로필 새로고침 실패: $e');
      });

  PushNotificationService.init()
      .timeout(const Duration(seconds: 10))
      .catchError((e) {
        debugPrint('❌ 푸시 알림 초기화 실패: $e');
      });

  const kakaoNativeAppKey = String.fromEnvironment(
    'KAKAO_NATIVE_APP_KEY',
    defaultValue: '06bf97b262cd1ef066386b4d25b9f3b8',
  );
  if (kakaoNativeAppKey.isNotEmpty) {
    try {
      KakaoSdk.init(nativeAppKey: kakaoNativeAppKey);
    } catch (e) {
      debugPrint('❌ 카카오 SDK 초기화 실패: $e');
    }
  }

  runApp(const InterviewMoaApp());
}

class InterviewMoaApp extends StatelessWidget {
  const InterviewMoaApp({super.key});

  @override
  Widget build(BuildContext context) {
    final baseTheme = ThemeData.light(useMaterial3: true);
    return MaterialApp(
      title: '부엉 스피치',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('ko', 'KR'), Locale('en', 'US')],
      locale: const Locale('ko', 'KR'),
      builder: (context, child) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: const TextScaler.linear(1.0),
            alwaysUse24HourFormat: false,
            boldText: false,
          ),
          child: child!,
        );
      },
      themeMode: ThemeMode.light,
      theme: baseTheme.copyWith(
        colorScheme: baseTheme.colorScheme.copyWith(
          primary: const Color(0xFF5D4037),
          secondary: const Color(0xFFFFC107),
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFFFFFDE7),
        iconTheme: baseTheme.iconTheme.copyWith(
          // Material Icons 폰트가 텍스트 테마에 덮이지 않도록 명시
          applyTextScaling: false,
        ),
        textTheme: baseTheme.textTheme.apply(
          bodyColor: const Color(0xFF111827),
          displayColor: const Color(0xFF111827),
        ),
        inputDecorationTheme: InputDecorationTheme(
          hintStyle: const TextStyle(
            fontSize: 16,
            color: Color(0xFF9CA3AF),
            fontWeight: FontWeight.normal,
          ),
          labelStyle: const TextStyle(
            fontSize: 16,
            color: Color(0xFF6B7280),
            fontWeight: FontWeight.normal,
          ),
          floatingLabelStyle: const TextStyle(
            fontSize: 16,
            color: Color(0xFF111827),
            fontWeight: FontWeight.w600,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0xFF111827), width: 1.8),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Colors.red),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Colors.red, width: 1.8),
          ),
          filled: true,
          fillColor: Colors.white,
        ),
      ),
      home: const InterviewRoot(),
    );
  }
}
