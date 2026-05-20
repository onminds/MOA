import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp();
  }
  debugPrint('백그라운드 메시지 수신: ${message.messageId}');
}

class PushNotificationService {
  PushNotificationService._();

  static bool _initialized = false;

  static bool get isSupportedPlatform =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  static Future<void> init() async {
    if (_initialized) {
      return;
    }

    if (!isSupportedPlatform) {
      debugPrint(
        'FCM은 현재 플랫폼(${describeEnum(defaultTargetPlatform)})에서 사용하지 않습니다.',
      );
      _initialized = true;
      return;
    }

    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp();
    }

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    final messaging = FirebaseMessaging.instance;

    final settings = await messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional) {
      final token = await messaging.getToken();
      debugPrint('FCM Token: $token');
      await _subscribeToGlobalTopic(messaging);
      // TODO: 서버로 토큰을 전달해 기기별 푸시를 보낼 수 있도록 합니다.
    } else {
      debugPrint('푸시 권한 거부: ${settings.authorizationStatus}');
      await _subscribeToGlobalTopic(messaging);
    }

    if (defaultTargetPlatform == TargetPlatform.iOS) {
      await messaging.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );
    }

    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint(
        '포그라운드 메시지: '
        '${message.notification?.title ?? '제목 없음'} / '
        '${message.notification?.body ?? '내용 없음'}',
      );
    });

    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('알림으로 앱 열림: ${message.messageId}');
    });

    _initialized = true;
  }

  static Future<void> _subscribeToGlobalTopic(
    FirebaseMessaging messaging,
  ) async {
    try {
      await messaging.subscribeToTopic('all-users');
      debugPrint('all-users 토픽 구독 완료');
    } catch (e) {
      debugPrint('토픽 구독 실패: $e');
    }
  }
}

