import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:dio/dio.dart';
import 'auth_service.dart';

class IapService {
  IapService._internal();
  static final IapService instance = IapService._internal();

  final InAppPurchase _iap = InAppPurchase.instance;
  StreamSubscription<List<PurchaseDetails>>? _subscription;
  bool _isVerifying = false; // 중복 검증 방지
  
  // iOS 네이티브 영수증 추출용 Method Channel
  static const MethodChannel _receiptChannel = MethodChannel('com.moa.iap/receipt');
  
  // 구매 완료 콜백
  Function(String planId)? onPurchaseSuccess;
  Function(String error)? onPurchaseError;

  // Apple 상품 ID (App Store Connect에서 등록한 ID와 일치해야 함)
  static const String productIdStandard = 'com.moa.subscription.standard';
  static const String productIdPro = 'com.moa.subscription.pro';
  
  // Google Play 상품 ID (Google Play Console에서 등록한 ID와 일치해야 함)
  // 40자 제한으로 짧게 변경
  static const String productIdStandardAndroid = 'com.onminds.moa.sub.standard';
  static const String productIdProAndroid = 'com.onminds.moa.sub.pro';
  
  // 플랫폼별 상품 ID 세트
  static Set<String> get productIds {
    if (Platform.isIOS) {
      return {productIdStandard, productIdPro};
    } else if (Platform.isAndroid) {
      return {productIdStandardAndroid, productIdProAndroid};
    }
    return {};
  }

  // 초기화
  Future<bool> initialize() async {
    if (!Platform.isIOS && !Platform.isAndroid) {
      debugPrint('[IAP] iOS/Android가 아니므로 IAP를 초기화하지 않습니다.');
      return false;
    }

    try {
      final available = await _iap.isAvailable();
      if (!available) {
        if (Platform.isIOS) {
          debugPrint('[IAP] ❌ StoreKit을 사용할 수 없습니다. (샌드박스 환경 확인 필요)');
        } else {
          debugPrint('[IAP] ❌ Google Play Billing을 사용할 수 없습니다.');
        }
        return false;
      }

      // 구매 스트림 리스너 등록
      _subscription = _iap.purchaseStream.listen(
        _handlePurchaseUpdates,
        onDone: () {
          debugPrint('[IAP] Purchase stream done');
          _subscription?.cancel();
        },
        onError: (error) {
          debugPrint('[IAP] ❌ Purchase stream error: $error');
          onPurchaseError?.call('구매 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        },
      );

      final platform = Platform.isIOS ? 'iOS' : 'Android';
      debugPrint('[IAP] ✅ $platform IAP 초기화 완료');
      return true;
    } catch (error, stack) {
      debugPrint('[IAP] ❌ 초기화 실패: $error');
      debugPrint('[IAP] Stack: $stack');
      return false;
    }
  }

  void dispose() {
    _subscription?.cancel();
  }

  // 상품 정보 조회
  Future<List<ProductDetails>> fetchProducts() async {
    if (!Platform.isIOS && !Platform.isAndroid) {
      return [];
    }

    try {
      final response = await _iap.queryProductDetails(productIds);
      if (response.error != null) {
        debugPrint('[IAP] ❌ 상품 조회 오류: ${response.error}');
        final storeName = Platform.isIOS ? 'App Store' : 'Google Play';
        final consoleName = Platform.isIOS ? 'App Store Connect' : 'Google Play Console';
        throw Exception('$storeName에서 구독 상품을 불러오지 못했습니다.\n네트워크 연결 또는 $consoleName 설정을 확인해주세요.');
      }
      
      if (response.notFoundIDs.isNotEmpty) {
        final consoleName = Platform.isIOS ? 'App Store Connect' : 'Google Play Console';
        debugPrint('[IAP] ⚠️ 찾을 수 없는 상품 ID: ${response.notFoundIDs}');
        debugPrint('[IAP] ⚠️ $consoleName에서 상품 설정을 확인하세요.');
      }

      if (response.productDetails.isEmpty) {
        final consoleName = Platform.isIOS ? 'App Store Connect' : 'Google Play Console';
        debugPrint('[IAP] ⚠️ 조회된 상품이 없습니다. $consoleName 상품 설정을 확인하세요.');
        throw Exception('구독 상품이 등록되지 않았습니다.\n$consoleName에서 In-App Purchase 상품을 확인해주세요.');
      }

      debugPrint('[IAP] ✅ 상품 조회 성공: ${response.productDetails.length}개');
      for (final product in response.productDetails) {
        debugPrint('[IAP]   - ${product.id}: ${product.title} (${product.price})');
      }
      return response.productDetails;
    } catch (error, stack) {
      debugPrint('[IAP] ❌ fetchProducts 실패: $error');
      debugPrint('[IAP] Stack: $stack');
      rethrow;
    }
  }

  // 구매 시작
  Future<bool> purchaseProduct(ProductDetails product) async {
    if (!Platform.isIOS && !Platform.isAndroid) {
      return false;
    }

    final purchaseParam = PurchaseParam(productDetails: product);
    
    try {
      debugPrint('[IAP] 구독 시작: ${product.id} (${Platform.isIOS ? "iOS" : "Android"})');
      
      // iOS와 Android 모두 자동 갱신 구독은 buyNonConsumable로 처리
      return await _iap.buyNonConsumable(purchaseParam: purchaseParam);
    } catch (error) {
      debugPrint('[IAP] ❌ 구독 시작 오류: $error');
      onPurchaseError?.call('구독을 시작하지 못했습니다.');
      return false;
    }
  }

  // 구매 복원
  Future<void> restorePurchases() async {
    if (!Platform.isIOS && !Platform.isAndroid) {
      return;
    }

    try {
      final platform = Platform.isIOS ? 'iOS' : 'Android';
      debugPrint('[IAP] $platform 구매 복원 시작');
      await _iap.restorePurchases();
      debugPrint('[IAP] 구매 복원 요청 완료 (결과는 purchaseStream으로 전달됨)');
    } catch (error) {
      debugPrint('[IAP] ❌ 구매 복원 오류: $error');
      onPurchaseError?.call('구매 복원에 실패했습니다.');
    }
  }

  // 구매 업데이트 처리
  void _handlePurchaseUpdates(List<PurchaseDetails> purchases) async {
    debugPrint('[IAP] 구매 업데이트: ${purchases.length}건');
    
    for (final purchase in purchases) {
      debugPrint('[IAP] Purchase status: ${purchase.status}, product: ${purchase.productID}');
      
      if (purchase.status == PurchaseStatus.purchased ||
          purchase.status == PurchaseStatus.restored) {
        // 서버 검증 및 완료 처리
        await _verifyAndFinish(purchase);
      } else if (purchase.status == PurchaseStatus.error) {
        debugPrint('[IAP] ❌ Purchase error: ${purchase.error}');
        final errorMsg = purchase.error?.message ?? '구매에 실패했습니다.';
        onPurchaseError?.call(errorMsg);
        
        // 에러 처리 시 안전하게 complete (타입 체크)
        try {
          if (purchase.pendingCompletePurchase) {
            await _iap.completePurchase(purchase);
          }
        } catch (e) {
          debugPrint('[IAP] ⚠️ completePurchase 실패 (무시): $e');
        }
      } else if (purchase.status == PurchaseStatus.pending) {
        debugPrint('[IAP] ⏳ Purchase pending: ${purchase.productID}');
      } else if (purchase.status == PurchaseStatus.canceled) {
        debugPrint('[IAP] 🚫 Purchase canceled: ${purchase.productID}');
        try {
          if (purchase.pendingCompletePurchase) {
            await _iap.completePurchase(purchase);
          }
        } catch (e) {
          debugPrint('[IAP] ⚠️ completePurchase 실패 (무시): $e');
        }
      }
    }
  }

  // 서버 검증 및 완료 처리
  Future<void> _verifyAndFinish(PurchaseDetails purchase) async {
    // 중복 호출 방지
    if (_isVerifying) return;
    _isVerifying = true;
    
    try {
      if (!Platform.isIOS && !Platform.isAndroid) {
        await _iap.completePurchase(purchase);
        _isVerifying = false;
        return;
      }

      debugPrint('[IAP] 서버 검증 시작: ${purchase.productID} (${Platform.isIOS ? "iOS" : "Android"})');

      final auth = AuthService.instance;
      await auth.restoreSession();
      try {
        await auth.ensureFreshToken();
      } catch (e) {
        debugPrint('[IAP] 토큰 갱신 실패: $e');
      }
      
      if (!auth.isLoggedIn || auth.token == null || auth.token!.isEmpty) {
        debugPrint('[IAP] 로그인 세션이 없어 서버 검증을 건너뜁니다.');
        await _iap.completePurchase(purchase);
        onPurchaseError?.call('로그인이 필요합니다.');
        _isVerifying = false;
        return;
      }

      final base = auth.client.options.baseUrl.trim();
      final baseUrl = base.isEmpty ? 'https://www.moa.tools' : base.replaceFirst(RegExp(r'/$'), '');

      final dio = Dio(BaseOptions(
        baseUrl: baseUrl,
        headers: {
          'Authorization': 'Bearer ${auth.token}',
          'X-Requested-With': 'moa_interview_flutter',
        },
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
      ));

      final productId = purchase.productID;
      final planId = _getPlanId(productId);
      if (planId == null) {
        debugPrint('[IAP] 알 수 없는 상품 ID: $productId');
        await _iap.completePurchase(purchase);
        onPurchaseError?.call('알 수 없는 상품입니다.');
        _isVerifying = false;
        return;
      }

      // 플랫폼별 검증 로직
      String endpoint;
      Map<String, dynamic> requestData;
      final isRestore = purchase.status == PurchaseStatus.restored;

      if (Platform.isIOS) {
        // iOS: App Store Receipt 추출
        String receiptData;
        try {
          receiptData = await _receiptChannel.invokeMethod('getAppStoreReceipt');
          debugPrint('[IAP] ✅ 네이티브 영수증 추출 성공: ${receiptData.length}자');
        } catch (e) {
          debugPrint('[IAP] ⚠️ 네이티브 영수증 추출 실패, 폴백 사용: $e');
          receiptData = purchase.verificationData.serverVerificationData;
        }
        
        final transactionId = purchase.purchaseID ?? '';
        
        endpoint = isRestore 
            ? '/api/mobile/payments/apple-iap/restore' 
            : '/api/mobile/payments/apple-iap/verify';
        
        requestData = {
          'receiptData': receiptData,
          'transactionId': transactionId,
          'originalTransactionId': transactionId,
          'productId': productId,
          'planId': planId,
        };
      } else {
        // Android: Google Play Purchase Token
        final purchaseToken = purchase.verificationData.serverVerificationData;
        final orderId = purchase.purchaseID ?? '';
        
        debugPrint('[IAP] Purchase Token 길이: ${purchaseToken.length}자');
        debugPrint('[IAP] Order ID: $orderId');
        
        endpoint = isRestore 
            ? '/api/mobile/payments/google-iap/restore' 
            : '/api/mobile/payments/google-iap/verify';
        
        requestData = {
          'purchaseToken': purchaseToken,
          'orderId': orderId,
          'productId': productId,
          'planId': planId,
          'packageName': 'com.onminds.moa_interview_prep',
        };
      }

      debugPrint('[IAP] API 요청: $endpoint');
      debugPrint('[IAP] 요청 데이터: ${requestData.keys}');

      final response = await dio.post(endpoint, data: requestData);

      if (response.statusCode == 200 || response.statusCode == 201) {
        debugPrint('[IAP] ✅ 서버 검증 성공: ${response.data}');
        await _iap.completePurchase(purchase);
        
        debugPrint('[IAP] 🎉 onPurchaseSuccess 콜백 호출: $planId');
        onPurchaseSuccess?.call(planId);
        debugPrint('[IAP] ✅ 구매 처리 완료!');
      } else {
        debugPrint('[IAP] ❌ 서버 검증 실패: ${response.statusCode}, ${response.data}');
        onPurchaseError?.call('서버 검증에 실패했습니다.');
        await _iap.completePurchase(purchase);
      }
      
    } catch (error) {
      debugPrint('[IAP] ❌ 검증 오류: $error');
      
      if (error is DioException) {
        debugPrint('[IAP] 상태 코드: ${error.response?.statusCode}');
        debugPrint('[IAP] 응답 데이터: ${error.response?.data}');
        debugPrint('[IAP] 에러 메시지: ${error.message}');
        
        final responseData = error.response?.data;
        String serverMessage = '구매 검증에 실패했습니다.';
        
        if (responseData is Map) {
          if (responseData['error'] != null) {
            serverMessage = responseData['error'].toString();
          } else if (responseData['details'] != null) {
            serverMessage = '${serverMessage}\n${responseData['details']}';
          }
        }
        
        onPurchaseError?.call(serverMessage);
      } else {
        final message = error.toString().contains('401')
            ? '로그인이 만료되었습니다. 다시 로그인 후 결제를 진행해주세요.'
            : '구매 검증에 실패했습니다.';
        onPurchaseError?.call(message);
      }
      
      await _iap.completePurchase(purchase);
    } finally {
      _isVerifying = false;
      debugPrint('[IAP] 검증 플래그 해제');
    }
  }

  // 플랜 ID 추출 (iOS & Android 모두 지원)
  String? _getPlanId(String productId) {
    // iOS 상품
    if (productId == productIdStandard || productId == productIdStandardAndroid) {
      return 'standard';
    }
    if (productId == productIdPro || productId == productIdProAndroid) {
      return 'pro';
    }
    return null;
  }

  // 플랜 ID → 상품 ID 매핑 (플랫폼별)
  String? getProductId(String planId) {
    if (Platform.isIOS) {
      switch (planId) {
        case 'standard':
          return productIdStandard;
        case 'pro':
          return productIdPro;
        default:
          return null;
      }
    } else if (Platform.isAndroid) {
      switch (planId) {
        case 'standard':
          return productIdStandardAndroid;
        case 'pro':
          return productIdProAndroid;
        default:
          return null;
      }
    }
    return null;
  }

  // IAP 사용 가능 플랫폼 여부
  static bool get isIAPSupported => Platform.isIOS || Platform.isAndroid;
  static bool get isIOS => Platform.isIOS;
  static bool get isAndroid => Platform.isAndroid;
}

