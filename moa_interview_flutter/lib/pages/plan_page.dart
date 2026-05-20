import 'dart:io';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/auth_service.dart';
import '../services/iap_service.dart';
import '../services/plan_service.dart';
import '../services/analytics_service.dart';
import 'inquiry_page.dart';
import 'terms_of_service_page.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

class PlanPage extends StatefulWidget {
  const PlanPage({super.key});

  @override
  State<PlanPage> createState() => _PlanPageState();
}

class _PlanPageState extends State<PlanPage> {
  static const String _appleEulaUrl =
      'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
  PlanDetails? _currentPlan;
  bool _isLoading = true;
  List<ProductDetails> _products = [];
  bool _iapAvailable = false;
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    
    try {
      // 로그인 확인
      await AuthService.instance.restoreSession();
      
      debugPrint('[플랜] 로그인 상태: ${AuthService.instance.isLoggedIn}');
      debugPrint('[플랜] 사용자 ID: ${AuthService.instance.currentUser?.id}');
      
      if (!AuthService.instance.isLoggedIn) {
        debugPrint('[플랜] 로그인되지 않아 기본 플랜으로 표시');
        if (mounted) {
          setState(() {
            _currentPlan = const PlanDetails(
              planType: 'basic',
              displayName: 'Basic',
              name: 'Basic',
            );
            _isLoading = false;
          });
        }
        // iOS/Android IAP는 로그인 없어도 조회 가능하도록
        if ((Platform.isIOS || Platform.isAndroid) && mounted) {
          await _loadIAPProducts();
        }
        return;
      }

      // 현재 플랜 조회
      debugPrint('[플랜] 서버에서 플랜 정보 로드 시작');
      final plan = await PlanService.instance.fetchPlan();
      debugPrint('[플랜] ✅ 플랜 정보 로드 성공!');
      debugPrint('[플랜]   - planType: ${plan.planType}');
      debugPrint('[플랜]   - displayName: ${plan.displayName}');
      debugPrint('[플랜]   - name: ${plan.name}');
      
      if ((Platform.isIOS || Platform.isAndroid) && mounted) {
        // iOS/Android: IAP 초기화 및 상품 조회
        await _loadIAPProducts();
      }
      
      if (mounted) {
        setState(() {
          _currentPlan = plan;
          _isLoading = false;
        });
        debugPrint('[플랜] setState 완료, 현재 플랜: ${_currentPlan?.planType}');
      }
    } catch (error, stack) {
      debugPrint('[플랜] ❌ 로드 오류: $error');
      debugPrint('[플랜] 스택: $stack');
      if (mounted) {
        setState(() {
          // 에러 시 기본 플랜으로 폴백
          _currentPlan = const PlanDetails(
            planType: 'basic',
            displayName: 'Basic',
            name: 'Basic',
          );
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('플랜 정보 로드 실패: ${error.toString()}')),
        );
      }
    }
  }

  Future<void> _loadIAPProducts() async {
    try {
      final iap = IapService.instance;
      final platform = Platform.isIOS ? 'iOS' : 'Android';
      final initialized = await iap.initialize();
      debugPrint('[플랜] $platform IAP 초기화: $initialized');
      
      if (!initialized) {
        final storeName = Platform.isIOS ? 'App Store' : 'Google Play';
        debugPrint('[플랜] ⚠️ IAP 초기화 실패 - $storeName를 사용할 수 없습니다.');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('$storeName 연결 실패. 네트워크를 확인하거나 나중에 다시 시도해주세요.'),
              duration: const Duration(seconds: 4),
            ),
          );
        }
        return;
      }
      
      final products = await iap.fetchProducts();
      debugPrint('[플랜] IAP 상품 ${products.length}개 조회됨');
      if (mounted) {
        setState(() {
          _products = products;
          _iapAvailable = true;
        });
      }
    } catch (error, stack) {
      debugPrint('[플랜] ❌ IAP 로드 실패: $error');
      debugPrint('[플랜] Stack: $stack');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('구독 상품을 불러올 수 없습니다.\n${error.toString()}'),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    }
  }

  Future<void> _handleSubscribe(String planId) async {
    if (_isProcessing) return;

    // 📊 Analytics: 구독 버튼 클릭
    await AnalyticsService.instance.logSubscriptionClicked(
      planType: planId,
      source: 'plan_page',
    );

    if (Platform.isIOS || Platform.isAndroid) {
      // iOS/Android: IAP 사용
      await _subscribeViaIAP(planId);
    } else {
      // 기타 플랫폼: 웹 결제로 리다이렉트
      await _subscribeViaWeb(planId);
    }
  }

  Future<void> _subscribeViaIAP(String planId) async {
    setState(() => _isProcessing = true);

    try {
      final storeName = Platform.isIOS ? 'App Store' : 'Google Play';
      final consoleName = Platform.isIOS ? 'App Store Connect' : 'Google Play Console';
      
      if (!_iapAvailable) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('$storeName 결제 시스템을 사용할 수 없습니다.\n네트워크 연결을 확인하거나 나중에 다시 시도해주세요.'),
              duration: const Duration(seconds: 5),
            ),
          );
        }
        return;
      }

      // 로그인 확인
      await AuthService.instance.restoreSession();
      if (!AuthService.instance.isLoggedIn) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('구독하려면 먼저 로그인이 필요합니다.'),
              duration: Duration(seconds: 4),
            ),
          );
        }
        return;
      }

      final iap = IapService.instance;
      final productId = iap.getProductId(planId);
      if (productId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('상품을 찾을 수 없습니다.')),
          );
        }
        return;
      }

      final product = _products.firstWhere(
        (p) => p.id == productId,
        orElse: () => throw Exception('상품을 찾을 수 없습니다. $consoleName 설정을 확인해주세요.'),
      );

      debugPrint('[플랜] 구매 시작: ${product.title} (${product.id})');

      // 구매 콜백 설정
      iap.onPurchaseSuccess = (plan) async {
        if (mounted) {
          // 플랜 정보 새로고침
          await _loadData();
          
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('🎉 구독이 완료되었습니다!'),
              duration: Duration(seconds: 3),
            ),
          );
          
          // 1초 후 플랜 페이지 닫고 메인으로 돌아가기 (다른 페이지도 갱신되도록)
          Future.delayed(const Duration(seconds: 1), () {
            if (mounted) {
              Navigator.of(context).pop(true); // true 반환으로 변경 알림
            }
          });
        }
      };

      iap.onPurchaseError = (error) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('구매 실패: $error'),
              duration: const Duration(seconds: 5),
            ),
          );
        }
      };

      // 구매 시작
      final started = await iap.purchaseProduct(product);
      if (!started) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('구매를 시작하지 못했습니다.\n$storeName 연결 상태를 확인해주세요.'),
              duration: const Duration(seconds: 5),
            ),
          );
        }
      }
    } catch (error, stack) {
      debugPrint('[플랜] ❌ IAP 구매 오류: $error');
      debugPrint('[플랜] Stack: $stack');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('구매 중 오류가 발생했습니다.\n${error.toString()}'),
            duration: const Duration(seconds: 6),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  Future<void> _subscribeViaWeb(String planId) async {
    // 안드로이드/웹: 웹 결제 페이지로 리다이렉트
    final auth = AuthService.instance;
    await auth.restoreSession();
    
    final base = auth.client.options.baseUrl.trim();
    final baseUrl = base.isEmpty ? 'https://www.moa.tools' : base.replaceFirst(RegExp(r'/$'), '');
    final url = '$baseUrl/plan?planId=$planId';

    if (await canLaunchUrl(Uri.parse(url))) {
      await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('결제 페이지를 열 수 없습니다.')),
        );
      }
    }
  }

  Future<void> _handleRestore() async {
    if (!Platform.isIOS && !Platform.isAndroid) return;

    setState(() => _isProcessing = true);

    try {
      final iap = IapService.instance;
      
      iap.onPurchaseSuccess = (plan) async {
        if (mounted) {
          await _loadData();
          
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('🎉 구독이 복원되었습니다!'),
              duration: Duration(seconds: 3),
            ),
          );
          
          Future.delayed(const Duration(seconds: 1), () {
            if (mounted) {
              Navigator.of(context).pop(true);
            }
          });
        }
      };

      iap.onPurchaseError = (error) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(error)),
          );
        }
      };

      await iap.restorePurchases();
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('복원을 시도 중입니다...')),
        );
      }
    } catch (error) {
      debugPrint('[플랜] ❌ 복원 오류: $error');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('복원에 실패했습니다.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isProcessing = false);
      }
    }
  }

  LinearGradient _getGradient(String planId) {
    switch (planId) {
      case 'basic':
        return const LinearGradient(
          colors: [Color(0xFF60A5FA), Color(0xFF2563EB)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case 'standard':
        return const LinearGradient(
          colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case 'pro':
        return const LinearGradient(
          colors: [Color(0xFFA78BFA), Color(0xFFEC4899)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      default:
        return const LinearGradient(
          colors: [Color(0xFF60A5FA), Color(0xFF2563EB)],
        );
    }
  }

  IconData _getIcon(String planId) {
    switch (planId) {
      case 'basic':
        return Icons.shield_outlined;
      case 'standard':
        return Icons.bolt;
      case 'pro':
        return Icons.workspace_premium;
      default:
        return Icons.shield_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final userName = AuthService.instance.currentUser?.name ?? '사용자';
    
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Stack(
              children: [
                CustomScrollView(
                  slivers: [
                    // 헤더 (뒤로가기 버튼 제외)
                    SliverToBoxAdapter(
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
                        child: Column(
                          children: [
                            // 뒤로가기 버튼 공간 확보
                            const SizedBox(height: 24),
                        // Crown 아이콘
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
                            ),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.workspace_premium, size: 32, color: Colors.white),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          '플랜 선택',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF111827),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '$userName님을 위한 최적의 플랜을 선택하세요',
                          style: const TextStyle(
                            fontSize: 16,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                        const SizedBox(height: 12),
                        // 할인 배너
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFFFF3B30), Color(0xFFFF9500)],
                            ),
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFFF3B30).withValues(alpha: 0.3),
                                blurRadius: 12,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Text(
                            '단 한 달! 놓치면 후회하는 특가 할인 진행 중!',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // 플랜 카드들
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      // Basic Plan은 현재 플랜이 Basic일 때만 표시
                      if (_currentPlan?.planType.toLowerCase() == 'basic') ...[
                        _buildPlanCard(
                          id: 'basic',
                          name: 'Basic Plan',
                          price: '0원',
                          period: '무료',
                          originalPrice: null,
                          description: '기본 기능을 무료로 이용',
                          features: const [
                            '월 1회 이미지 생성',
                            '월 1회 영상 생성',
                            '생산성 도구 통합 1회',
                            '커뮤니티 작성',
                            '이메일 지원',
                          ],
                          isPopular: false,
                        ),
                        const SizedBox(height: 16),
                      ],
                      _buildPlanCard(
                        id: 'standard',
                        name: 'Standard Plan',
                        price: '15,900원',
                        period: '월',
                        originalPrice: '19,900원',
                        description: '개인 사용자를 위한 표준 플랜',
                        features: const [
                          '월 80회 이미지 생성',
                          '월 20회 영상 생성',
                          '생산성 도구 통합 120회',
                          '커뮤니티 읽기',
                          '이메일 지원',
                          '광고 제거',
                        ],
                        isPopular: true,
                      ),
                      const SizedBox(height: 16),
                      _buildPlanCard(
                        id: 'pro',
                        name: 'Pro Plan',
                        price: '29,000원',
                        period: '월',
                        originalPrice: '35,000원',
                        description: '팀과 기업을 위한 고급 기능',
                        features: const [
                          '월 180회 이미지 생성',
                          '월 40회 영상 생성',
                          '생산성 도구 통합 250회',
                          '커뮤니티 읽기',
                          '이메일 지원',
                          '광고 제거',
                        ],
                        isPopular: false,
                      ),
                      const SizedBox(height: 16),
                      _buildAdCard(),
                    ]),
                  ),
                ),

                // 현재 플랜 상태 박스
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                    child: _buildCurrentPlanStatus(),
                  ),
                ),

                // FAQ 섹션
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 40, 16, 0),
                    child: _buildFAQSection(),
                  ),
                ),

                // 하단 버튼들
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 40, 16, 32),
                    child: _buildBottomActions(),
                  ),
                ),
              ],
            ),
                
                // 상단 고정 뒤로가기 버튼
                Positioned(
                  top: MediaQuery.of(context).padding.top + 16,
                  left: 16,
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(
                        Icons.arrow_back_ios_new,
                        color: Color(0xFF111827),
                        size: 20,
                      ),
                      padding: const EdgeInsets.all(12),
                      constraints: const BoxConstraints(),
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildPlanCard({
    required String id,
    required String name,
    required String price,
    required String period,
    String? originalPrice,
    required String description,
    required List<String> features,
    required bool isPopular,
  }) {
    // 현재 플랜 체크 (대소문자 무시, 공백 제거)
    final currentPlanType = _currentPlan?.planType.trim().toLowerCase();
    final cardPlanType = id.trim().toLowerCase();
    final isCurrentPlan = currentPlanType == cardPlanType;
    
    debugPrint('[플랜카드] id=$id, currentPlan=$currentPlanType, isCurrentPlan=$isCurrentPlan');
    
    final canUpgrade = id != 'basic' && !isCurrentPlan;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isPopular
            ? Border.all(color: const Color(0xFFFBBF24), width: 2)
            : null,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // 인기 뱃지
          if (isPopular)
            Positioned(
              top: -12,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
                    ),
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFFBBF24).withValues(alpha: 0.4),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.star, size: 16, color: Colors.white),
                      SizedBox(width: 4),
                      Text(
                        '인기',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // 카드 내용
          Padding(
            padding: EdgeInsets.all(isPopular ? 32 : 24),
            child: Column(
              children: [
                // 아이콘
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: _getGradient(id),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(_getIcon(id), size: 32, color: Colors.white),
                ),
                const SizedBox(height: 16),

                // 플랜명
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF111827),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),

                // 가격
                if (originalPrice != null) ...[
                  Text(
                    originalPrice,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF9CA3AF),
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                  const SizedBox(height: 4),
                ],
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      price,
                      style: const TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF111827),
                      ),
                    ),
                    if (period != '무료')
                      Text(
                        '/$period',
                        style: const TextStyle(
                          fontSize: 16,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),

                // 설명
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF6B7280),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),

                // 기능 목록
                Column(
                  children: features
                      .map(
                        (feature) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(
                                Icons.check_circle,
                                size: 20,
                                color: Color(0xFF10B981),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  feature,
                                  style: const TextStyle(
                                    fontSize: 14,
                                    color: Color(0xFF374151),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 16),

                // 버튼
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: isCurrentPlan
                      ? ElevatedButton(
                          onPressed: null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFE5E7EB),
                            disabledBackgroundColor: const Color(0xFFE5E7EB),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: const Text(
                            '현재 플랜',
                            style: TextStyle(
                              color: Color(0xFF6B7280),
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                            ),
                          ),
                        )
                      : ElevatedButton(
                          onPressed: _isProcessing ? null : () => _handleSubscribe(id),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF111827),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                          ),
                          child: _isProcessing
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                  ),
                                )
                              : Text(
                                  id == 'basic' 
                                    ? '무료로 시작' 
                                    : (Platform.isIOS || Platform.isAndroid) 
                                      ? '구독하기' 
                                      : '웹에서 구독하기',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                  ),
                                ),
                        ),
                ),
                // 유료 플랜인 경우 구독 관련 약관 링크 표시
                if (id != 'basic') ...[
                  const SizedBox(height: 12),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      InkWell(
                        onTap: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const TermsOfServicePage()),
                          );
                        },
                        child: const Text(
                          '이용약관',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF6B7280),
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                      const Text(
                        '•',
                        style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                      ),
                      InkWell(
                        onTap: () async {
                          const url = 'https://www.moa.tools/privacy';
                          if (await canLaunchUrl(Uri.parse(url))) {
                            await launchUrl(
                              Uri.parse(url),
                              mode: LaunchMode.externalApplication,
                            );
                          }
                        },
                        child: const Text(
                          '개인정보처리방침',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF6B7280),
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                      const Text(
                        '•',
                        style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                      ),
                      if (Platform.isIOS)
                        InkWell(
                          onTap: () async {
                            if (await canLaunchUrl(Uri.parse(_appleEulaUrl))) {
                              await launchUrl(
                                Uri.parse(_appleEulaUrl),
                                mode: LaunchMode.externalApplication,
                              );
                            }
                          },
                          child: const Text(
                            'Apple 표준 이용약관(EULA)',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6B7280),
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    Platform.isIOS
                      ? '• 구독 기간: 1개월 (자동 갱신)\n'
                        '• 구독은 현재 기간이 끝나기 최소 24시간 전에 취소하지 않으면 자동으로 갱신됩니다.\n'
                        '• 구독 관리 및 취소는 iPhone 설정에서 가능합니다.'
                      : Platform.isAndroid
                        ? '• 구독 기간: 1개월 (자동 갱신)\n'
                          '• 구독은 현재 기간이 끝나기 최소 24시간 전에 취소하지 않으면 자동으로 갱신됩니다.\n'
                          '• 구독 관리 및 취소는 Google Play 스토어 앱의 구독 메뉴에서 가능합니다.'
                        : '• 구독 기간: 1개월 (자동 갱신)\n'
                          '• 구독 관리는 웹사이트에서 가능합니다.',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF9CA3AF),
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAdCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // 아이콘
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF818CF8), Color(0xFFA78BFA)],
                ),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.campaign, size: 32, color: Colors.white),
            ),
            const SizedBox(height: 16),

            // 제목
            const Text(
              'AI 목록 광고',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: Color(0xFF111827),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),

            // 설명
            const Text(
              '우리 플랫폼에 AI 도구를 효과적으로 노출하세요',
              style: TextStyle(
                fontSize: 14,
                color: Color(0xFF6B7280),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            const Text(
              '전문 에디토리얼 큐레이션과 추천 영역 노출로 유입을 극대화합니다.',
              style: TextStyle(
                fontSize: 14,
                color: Color(0xFF6B7280),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),

            // 기능 목록
            Column(
              children: [
                '추천·인기 섹션 노출 기회',
                '브랜드 신뢰도 향상과 전환 증대',
                '타깃 고객 유입/리드 확보',
                '전문 매니저 상담 지원',
              ]
                  .map(
                    (feature) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.check_circle,
                            size: 20,
                            color: Color(0xFF10B981),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              feature,
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF374151),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 16),

            // 버튼
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const InquiryPage()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF111827),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  '문의하기',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentPlanStatus() {
    if (_currentPlan == null) return const SizedBox.shrink();

    final planInfo = _getPlanDisplayInfo(_currentPlan!.planType);

    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 500),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFFBBF24), width: 2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '현재 플랜',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF111827),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: _getGradient(_currentPlan!.planType),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.workspace_premium, size: 16, color: Colors.white),
                      const SizedBox(width: 4),
                      Text(
                        '${_currentPlan!.displayName} Plan',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              planInfo['description']!,
              style: const TextStyle(
                fontSize: 15,
                color: Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _currentPlan!.planType == 'basic' ? '무료 플랜' : '매월 자동 결제',
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF111827),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Map<String, String> _getPlanDisplayInfo(String planType) {
    switch (planType.toLowerCase()) {
      case 'standard':
        return {
          'name': 'Standard Plan',
          'description': 'Standard Plan을 이용하고 계십니다.',
        };
      case 'pro':
        return {
          'name': 'Pro Plan',
          'description': 'Pro Plan을 이용하고 계십니다.',
        };
      default:
        return {
          'name': 'Basic Plan',
          'description': '기본 기능을 무료로 이용하고 계십니다.',
        };
    }
  }

  Widget _buildFAQSection() {
    final faqs = [
      {
        'question': '언제든지 플랜을 변경할 수 있나요?',
        'answer': '네, 언제든지 플랜을 업그레이드하거나 다운그레이드할 수 있습니다. 변경사항은 즉시 적용됩니다.',
      },
      {
        'question': '환불 정책은 어떻게 되나요?',
        'answer': '구매 후 7일 이내에 100% 환불을 제공합니다. 단, 사용량이 많지 않은 경우에만 적용됩니다.',
      },
      {
        'question': '팀 플랜은 어떻게 작동하나요?',
        'answer': 'Pro 플랜에서는 팀원을 초대하여 함께 사용할 수 있습니다. 팀 관리 기능을 통해 사용량을 모니터링할 수 있습니다.',
      },
      {
        'question': '결제 방법은 어떤 것이 있나요?',
        'answer': Platform.isIOS
            ? 'iOS에서는 App Store 인앱결제(IAP)로만 구독하실 수 있습니다.'
            : Platform.isAndroid
              ? 'Android에서는 Google Play 인앱결제로만 구독하실 수 있습니다.'
              : '신용카드, 체크카드, 간편결제(카카오페이, 네이버페이), 계좌이체 등 다양한 결제 방법을 지원합니다.',
      },
      if (Platform.isIOS)
        {
          'question': '구독을 취소하려면 어떻게 하나요?',
          'answer': 'iPhone 설정 > 맨 위 본인 이름 탭 > 구독 > MOA TOOLS 선택 > 구독 취소를 눌러 취소하실 수 있습니다. 취소 후에도 결제 기간 종료일까지 서비스를 이용하실 수 있습니다.',
        },
      if (Platform.isAndroid)
        {
          'question': '구독을 취소하려면 어떻게 하나요?',
          'answer': 'Google Play 스토어 앱 > 메뉴 > 구독 > MOA TOOLS 선택 > 구독 취소를 눌러 취소하실 수 있습니다. 취소 후에도 결제 기간 종료일까지 서비스를 이용하실 수 있습니다.',
        },
    ];

    return Column(
      children: [
        const Text(
          '자주 묻는 질문',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w900,
            color: Color(0xFF111827),
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 32),
        LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth > 800) {
              // 2x2 그리드
              return Wrap(
                spacing: 16,
                runSpacing: 16,
                children: faqs
                    .map((faq) => SizedBox(
                          width: (constraints.maxWidth - 16) / 2,
                          child: _buildFAQCard(faq['question']!, faq['answer']!),
                        ))
                    .toList(),
              );
            } else {
              // 세로 나열
              return Column(
                children: faqs
                    .map((faq) => Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: _buildFAQCard(faq['question']!, faq['answer']!),
                        ))
                    .toList(),
              );
            }
          },
        ),
      ],
    );
  }

  Widget _buildFAQCard(String question, String answer) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            question,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            answer,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF6B7280),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomActions() {
    return Column(
      children: [
        const Text(
          '추가 질문이 있으시면 언제든지 문의해 주세요',
          style: TextStyle(
            fontSize: 15,
            color: Color(0xFF6B7280),
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          alignment: WrapAlignment.center,
          children: [
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const InquiryPage()),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF111827),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
              child: const Text(
                '고객 지원 문의',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
            if (Platform.isIOS || Platform.isAndroid) ...[
              TextButton.icon(
                onPressed: _isProcessing ? null : _handleRestore,
                icon: const Icon(Icons.restore, size: 18),
                label: const Text('구매 복원'),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF111827),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
