import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';

/// Firebase Analytics 이벤트 추적 서비스
/// 
/// 광고 성과 측정 및 사용자 행동 분석을 위한 핵심 이벤트를 기록합니다.
class AnalyticsService {
  AnalyticsService._();
  
  static final AnalyticsService instance = AnalyticsService._();
  
  late final FirebaseAnalytics _analytics;
  late final FirebaseAnalyticsObserver observer;
  
  bool _initialized = false;
  
  /// Analytics 초기화
  Future<void> initialize() async {
    if (_initialized) return;
    
    try {
      _analytics = FirebaseAnalytics.instance;
      observer = FirebaseAnalyticsObserver(analytics: _analytics);
      _initialized = true;
      debugPrint('✅ Firebase Analytics 초기화 완료');
    } catch (e) {
      debugPrint('❌ Firebase Analytics 초기화 실패: $e');
    }
  }
  
  // ========================================
  // 1️⃣ 핵심 전환 이벤트 (Conversion Events)
  // ========================================
  
  /// 회원가입 완료
  Future<void> logSignUp({required String method}) async {
    await _logEvent('sign_up', parameters: {
      'method': method, // 'google', 'kakao', 'apple', 'email'
    });
  }
  
  /// 구독 버튼 클릭 (매출 의도 파악)
  Future<void> logSubscriptionClicked({
    required String planType, // 'standard' or 'pro'
    String? source, // 클릭 위치: 'plan_page', 'usage_limit', 'chat_page'
  }) async {
    await _logEvent('subscription_clicked', parameters: {
      'plan_type': planType,
      'source': source ?? 'unknown',
    });
  }
  
  /// 구독 구매 완료
  Future<void> logPurchase({
    required String planType,
    required double value,
    required String currency,
  }) async {
    await _logEvent('purchase', parameters: {
      'plan_type': planType,
      'value': value,
      'currency': currency,
    });
  }
  
  // ========================================
  // 2️⃣ 핵심 기능 사용 이벤트
  // ========================================
  
  /// AI 질문 전송 (핵심 기능 사용 여부)
  Future<void> logAiPromptSent({
    required String feature, // 'chat', 'unified_chat', 'summary', 'cover_letter', 등
    String? modelName,
  }) async {
    await _logEvent('ai_prompt_sent', parameters: {
      'feature': feature,
      'model_name': modelName ?? 'unknown',
    });
  }
  
  /// AI 모델 변경 (MOA Tools만의 강점 활용도)
  Future<void> logModelSwitched({
    required String fromModel,
    required String toModel,
  }) async {
    await _logEvent('model_switched', parameters: {
      'from_model': fromModel,
      'to_model': toModel,
    });
  }
  
  // ========================================
  // 3️⃣ 페이지 진입 이벤트 (사용자 관심도)
  // ========================================
  
  /// AI 목록 페이지 진입
  Future<void> logAiListViewed() async {
    await _logEvent('ai_list_viewed');
  }
  
  /// AI 종합 채팅 시작
  Future<void> logUnifiedChatStarted() async {
    await _logEvent('ai_unified_chat_started');
  }
  
  /// 이미지 생성 페이지 진입
  Future<void> logImageGenerationStarted({String? provider}) async {
    await _logEvent('image_generation_started', parameters: {
      if (provider != null) 'provider': provider, // 'flux', 'dalle', 'stable_diffusion'
    });
  }
  
  /// 영상 생성 페이지 진입
  Future<void> logVideoGenerationStarted() async {
    await _logEvent('video_generation_started');
  }
  
  /// 자기소개서 작성 시작
  Future<void> logCoverLetterStarted() async {
    await _logEvent('cover_letter_started');
  }
  
  /// 면접 준비 시작
  Future<void> logInterviewPrepStarted() async {
    await _logEvent('interview_prep_started');
  }
  
  /// PPT 생성 시작
  Future<void> logPptGenerationStarted() async {
    await _logEvent('ppt_generation_started');
  }
  
  /// 강의노트 생성 시작
  Future<void> logLectureNotesStarted() async {
    await _logEvent('lecture_notes_started');
  }
  
  // ========================================
  // 4️⃣ 공유 및 바이럴 이벤트
  // ========================================
  
  /// 결과 공유 (바이럴 지수 측정)
  Future<void> logShareResult({
    required String contentType, // 'image', 'text', 'video', 'ppt'
    String? method, // 'kakao', 'copy_link', 'download'
  }) async {
    await _logEvent('share_result', parameters: {
      'content_type': contentType,
      'method': method ?? 'unknown',
    });
  }
  
  // ========================================
  // 5️⃣ 사용량 및 제한 이벤트
  // ========================================
  
  /// 사용량 제한 도달
  Future<void> logUsageLimitReached({
    required String feature,
    required int currentUsage,
    required int maxLimit,
  }) async {
    await _logEvent('usage_limit_reached', parameters: {
      'feature': feature,
      'current_usage': currentUsage,
      'max_limit': maxLimit,
    });
  }
  
  /// 사용량 페이지 조회
  Future<void> logUsagePageViewed() async {
    await _logEvent('usage_page_viewed');
  }
  
  // ========================================
  // 6️⃣ 사용자 속성 설정
  // ========================================
  
  /// 사용자 플랜 설정
  Future<void> setUserPlan(String planType) async {
    if (!_initialized) return;
    try {
      await _analytics.setUserProperty(name: 'user_plan', value: planType);
    } catch (e) {
      debugPrint('❌ 사용자 속성 설정 실패: $e');
    }
  }
  
  /// 사용자 ID 설정
  Future<void> setUserId(String? userId) async {
    if (!_initialized) return;
    try {
      await _analytics.setUserId(id: userId);
    } catch (e) {
      debugPrint('❌ 사용자 ID 설정 실패: $e');
    }
  }
  
  // ========================================
  // Private 헬퍼 메서드
  // ========================================
  
  Future<void> _logEvent(String name, {Map<String, Object>? parameters}) async {
    if (!_initialized) {
      debugPrint('⚠️ Analytics 미초기화 상태에서 이벤트 시도: $name');
      return;
    }
    
    try {
      await _analytics.logEvent(
        name: name,
        parameters: parameters,
      );
      debugPrint('📊 Analytics: $name ${parameters ?? ''}');
    } catch (e) {
      debugPrint('❌ Analytics 이벤트 로깅 실패 [$name]: $e');
    }
  }
}
