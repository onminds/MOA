// MOA 본앱(moatools)과 패키지가 달라도 동일 Firebase 프로젝트로 초기화할 수 있도록 옵션만 분리합니다.
// FCM/Analytics를 면접 앱 전용으로 완전히 쓰려면 Firebase 콘솔에 Android/iOS 앱을 각각 추가한 뒤
// appId·apiKey·plist를 콘솔 값으로 교체하세요.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError('moa_interview_flutter: web 미지원');
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'moa_interview_flutter: 지원하지 않는 플랫폼',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAEWC9LmR0VAe0Fz3II1WUqMVlJ7XjoHtw',
    appId: '1:340070891940:android:f8eddbcca44cb0d7df8131',
    messagingSenderId: '340070891940',
    projectId: 'moatools-e69c8',
    storageBucket: 'moatools-e69c8.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyDYFPXD5K3PhmgKeXFs5lmElMIyQVYWcHs',
    appId: '1:340070891940:ios:835970efe2ce337bdf8131',
    messagingSenderId: '340070891940',
    projectId: 'moatools-e69c8',
    storageBucket: 'moatools-e69c8.firebasestorage.app',
    iosBundleId: 'com.onminds.moaInterviewPrep',
  );
}
