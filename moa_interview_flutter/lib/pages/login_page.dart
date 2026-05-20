import 'dart:io';

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:url_launcher/url_launcher.dart';

import '../interview_root.dart';
import '../services/ai_data_consent.dart';
import '../services/auth_service.dart';
import '../services/plan_service.dart';
import '../services/analytics_service.dart';
import 'inquiry_page.dart';
import 'plan_page.dart';
import 'profile_settings_page.dart';
import 'service_info_page.dart';
import 'terms_of_service_page.dart';
import 'usage_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    required this.onBack,
    this.onLoginSuccess,
    this.restartAppShellOnSuccess = false,
  });

  final VoidCallback onBack;
  final VoidCallback? onLoginSuccess;

  /// 로그아웃 등으로 네비게이터에 [LoginPage]만 남은 경우, 로그인 성공 후 [InterviewRoot]로 스택을 복구한다.
  final bool restartAppShellOnSuccess;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> with WidgetsBindingObserver {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final AuthService _auth = AuthService.instance;
  final PlanService _planService = PlanService.instance;

  bool _isEmailLoading = false;
  bool _isGoogleLoading = false;
  bool _isKakaoLoading = false;
  bool _isAppleLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;
  bool _isPlanLoading = false;
  PlanDetails? _planDetails;
  String? _planError;
  String? _planUserId;
  bool _isSignupMode = false; // 회원가입 모드 상태

  bool get _isBusy => _isEmailLoading || _isGoogleLoading || _isKakaoLoading || _isAppleLoading;

  /// Sign in with Apple 네이티브 UI는 iOS·macOS에서만 지원(Android 등은 별도 웹 OAuth 설정 필요).
  bool get _canShowAppleLogin =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.macOS);

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _emailController.dispose();
    _passwordController.dispose();
    _auth.userNotifier.removeListener(_handleUserChange);
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _auth.userNotifier.addListener(_handleUserChange);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _handleUserChange();
    });
  }

  void _clearError() {
    if (_errorMessage != null) {
      setState(() {
        _errorMessage = null;
      });
    }
  }

  void _handleLoginSuccessNavigation() {
    widget.onLoginSuccess?.call();
    if (!widget.restartAppShellOnSuccess) {
      return;
    }
    if (!context.mounted) return;
    // 프로필 탭 등 하위에 Navigator가 있어도 앱 전체 스택을 반드시 교체한다.
    Navigator.of(context, rootNavigator: true).pushAndRemoveUntil<void>(
      MaterialPageRoute<void>(builder: (_) => const InterviewRoot()),
      (route) => false,
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _auth.isLoggedIn) {
      _fetchPlan(force: true);
    }
  }

  void _handleUserChange() {
    final user = _auth.currentUser;
    if (user == null) {
      if (!mounted) return;
      setState(() {
        _planDetails = null;
        _planError = null;
        _planUserId = null;
        _isPlanLoading = false;
      });
      return;
    }

    if (_planUserId != user.id) {
      if (mounted) {
        setState(() {
          _planUserId = user.id;
          _planDetails = null;
          _planError = null;
        });
      }
      _fetchPlan();
      return;
    }

    if (_planDetails == null && !_isPlanLoading && _planError == null) {
      _fetchPlan();
    }
  }

  Future<void> _fetchPlan({bool force = false}) async {
    final user = _auth.currentUser;
    if (user == null) {
      return;
    }

    _planUserId ??= user.id;
    final String? expectedUserId = _planUserId;

    if (_isPlanLoading) {
      if (!force) {
        return;
      }
    } else if (!force && _planDetails != null && _planError == null) {
      return;
    }

    setState(() {
      _isPlanLoading = true;
      _planError = null;
    });

    try {
      final plan = await _planService.fetchPlan();
      if (!mounted || expectedUserId != _planUserId) {
        return;
      }
      setState(() {
        _planDetails = plan;
        _planError = null;
      });
    } on PlanException catch (error) {
      if (!mounted || expectedUserId != _planUserId) {
        return;
      }
      setState(() {
        _planDetails = null;
        _planError = error.message;
      });
    } catch (_) {
      if (!mounted || expectedUserId != _planUserId) {
        return;
      }
      setState(() {
        _planDetails = null;
        _planError = '플랜 정보를 불러오지 못했습니다.';
      });
    } finally {
      if (mounted && expectedUserId == _planUserId) {
        setState(() {
          _isPlanLoading = false;
        });
      }
    }
  }

  Future<void> _handleEmailLogin() async {
    if (!_formKey.currentState!.validate()) return;

    if (!await AiDataConsent.isAccepted()) {
      final termsAccepted = await _showTermsAgreementDialog();
      if (!mounted) return;
      if (termsAccepted != true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('서비스 이용·AI 데이터 처리에 동의해야 로그인이 가능합니다.')),
        );
        return;
      }
    }
    if (!mounted) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _isEmailLoading = true;
      _errorMessage = null;
    });

    try {
      await _auth.loginWithEmail(
        email: _emailController.text.trim(),
        password: _passwordController.text.trim(),
      );
      _handleLoginSuccessNavigation();
      if (!mounted) return;
    } on AuthException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '로그인 중 문제가 발생했습니다.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isEmailLoading = false;
        });
      }
    }
  }

  Future<void> _handleSignup() async {
    if (!_formKey.currentState!.validate()) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    final suggestedName = email.contains('@') ? email.split('@').first : email;
    final name = await _promptDisplayName(suggestedName);
    if (!mounted) return;

    if (name == null) {
      return;
    }

    bool? termsAccepted = true;
    if (!await AiDataConsent.isAccepted()) {
      termsAccepted = await _showTermsAgreementDialog();
    }
    if (!mounted) return;

    if (termsAccepted != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('서비스 이용·AI 데이터 처리에 동의해야 회원가입이 가능합니다.')),
      );
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _isEmailLoading = true;
      _errorMessage = null;
    });

    try {
      await _auth.signup(email: email, password: password, name: name);
      _handleLoginSuccessNavigation();
      if (!mounted) return;
      await AnalyticsService.instance.logSignUp(method: 'email');
    } on AuthException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '회원가입 중 문제가 발생했습니다.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isEmailLoading = false;
        });
      }
    }
  }

  Future<bool?> _showTermsAgreementDialog() async {
    return showDialog<bool>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFFFAF8F5), // Warm beige/wood background
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: const Text(
          '서비스 및 AI 데이터 처리 동의',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: Color(0xFF3E2723), // Dark wood text
          ),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '【필수】서비스 이용',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: Color(0xFF3E2723),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '부엉 스피치를 이용하시려면 아래에 동의하셔야 합니다:\n\n'
                '• 서비스 이용약관\n'
                '• 개인정보 처리방침\n'
                '• 커뮤니티 가이드라인\n\n'
                '사용자 생성 콘텐츠에 대한 부적절 게시 금지 정책에 동의하셔야 합니다.',
                style: TextStyle(
                  height: 1.6,
                  fontSize: 14,
                  color: Color(0xFF4E342E),
                ),
              ),
              const SizedBox(height: 8),
              InkWell(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const TermsOfServicePage()),
                  );
                },
                child: const Text(
                  '전체 이용약관 보기 →',
                  style: TextStyle(
                    color: Color(0xFF8D6E63), // Muted brown
                    decoration: TextDecoration.underline,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                '【필수】AI 기능 및 제3자 AI 전송',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  color: Color(0xFF3E2723),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'AI 면접 질문 추천, 답변·음성 분석 등 기능 제공을 위해, '
                '입력하신 지원 회사·직무, 경력·경험, 면접 질문·답변(텍스트), '
                '음성 답변 및 이를 토대로 변환·분석된 내용 등이 '
                '주식회사 온마인즈(서비스 운영) 서버를 거쳐 '
                '회사가 연동한 제3자 인공지능(AI) 서비스로 전송·처리될 수 있습니다.\n\n'
                '제3자의 명칭, 위탁·처리 위치 등 상세는 개인정보처리방침을 확인해 주세요. '
                '「동의합니다」를 누르면 위 AI 관련 전송·처리에도 동의하는 것으로 봅니다.',
                style: TextStyle(
                  height: 1.6,
                  fontSize: 14,
                  color: Color(0xFF4E342E),
                ),
              ),
              const SizedBox(height: 8),
              InkWell(
                onTap: () async {
                  final uri = Uri.parse('https://www.moa.tools/privacy');
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                  }
                },
                child: const Text(
                  '개인정보처리방침 보기(웹) →',
                  style: TextStyle(
                    color: Color(0xFF8D6E63),
                    decoration: TextDecoration.underline,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text(
              '동의하지 않음',
              style: TextStyle(
                color: Color(0xFF9E9E9E),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              await AiDataConsent.setAccepted();
              if (context.mounted) {
                Navigator.of(context).pop(true);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF4E342E), // Dark wood background
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text(
              '동의합니다',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  void _openProfileSettings() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const ProfileSettingsPage()),
    );
  }

  void _openUsagePage() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const UsagePage()));
  }

  void _openInquiryPage() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const InquiryPage()));
  }

  Future<bool> _launchWithWebSession(String redirectPath) async {
    final auth = AuthService.instance;
    await auth.restoreSession();
    final token = auth.token;
    if (token == null || token.isEmpty) {
      if (!mounted) return false;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('로그인이 필요합니다. 다시 시도해 주세요.')),
      );
      return false;
    }

    final uri = Uri.https('www.moa.tools', '/mobile-link', {
      'token': token,
      'redirect': redirectPath,
    });

    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('웹페이지를 열 수 없습니다. 잠시 후 다시 시도해주세요.')),
      );
    }
    return launched;
  }

  Future<void> _openPlanGuide() async {
    // iOS/Android 모두 앱 내 플랜 페이지 사용 (Google Play 정책 준수)
    if (Platform.isIOS || Platform.isAndroid) {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const PlanPage()),
      );
      return;
    }
    // 기타 플랫폼(웹 등)은 웹 페이지로 이동
    await _launchWithWebSession('/plan');
  }

  void _openServiceInfo() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const ServiceInfoPage()),
    );
  }

  Future<void> _openWebsite() async {
    await _launchWithWebSession('/');
  }

  Future<String?> _promptDisplayName(String defaultName) async {
    final controller = TextEditingController(text: defaultName);
    return showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('이름 또는 별명을 입력해주세요'),
          content: TextField(
            controller: controller,
            autofocus: true,
            decoration: const InputDecoration(hintText: '표시할 이름을 입력하세요'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(null),
              child: const Text('취소'),
            ),
            FilledButton(
              onPressed: () {
                final value = controller.text.trim();
                Navigator.of(context).pop(value.isEmpty ? defaultName : value);
              },
              child: const Text('확인'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _handleGoogleLogin() async {
    bool? termsAccepted = true;
    if (!await AiDataConsent.isAccepted()) {
      termsAccepted = await _showTermsAgreementDialog();
    }
    if (!mounted) return;

    if (termsAccepted != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('서비스 이용·AI 데이터 처리에 동의해야 로그인이 가능합니다.')),
      );
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _isGoogleLoading = true;
      _errorMessage = null;
    });

    try {
      await _auth.loginWithGoogle();
      _handleLoginSuccessNavigation();
      if (!mounted) return;
    } on AuthException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Google 로그인에 실패했습니다.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isGoogleLoading = false;
        });
      }
    }
  }

  Future<void> _handleKakaoLogin() async {
    bool? termsAccepted = true;
    if (!await AiDataConsent.isAccepted()) {
      termsAccepted = await _showTermsAgreementDialog();
    }
    if (!mounted) return;

    if (termsAccepted != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('서비스 이용·AI 데이터 처리에 동의해야 로그인이 가능합니다.')),
      );
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _isKakaoLoading = true;
      _errorMessage = null;
    });

    try {
      await _auth.loginWithKakao();
      _handleLoginSuccessNavigation();
      if (!mounted) return;
    } on AuthException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '카카오 로그인에 실패했습니다.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isKakaoLoading = false;
        });
      }
    }
  }

  Future<void> _handleAppleLogin() async {
    bool? termsAccepted = true;
    if (!await AiDataConsent.isAccepted()) {
      termsAccepted = await _showTermsAgreementDialog();
    }
    if (!mounted) return;

    if (termsAccepted != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('서비스 이용·AI 데이터 처리에 동의해야 로그인이 가능합니다.')),
      );
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _isAppleLoading = true;
      _errorMessage = null;
    });

    try {
      await _auth.loginWithApple();
      _handleLoginSuccessNavigation();
      if (!mounted) return;
    } on AuthException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.message;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Apple 로그인에 실패했습니다.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Apple 로그인에 실패했습니다.')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isAppleLoading = false;
        });
      }
    }
  }

  Future<void> _handleLogout() async {
    await _auth.logout();
    if (!mounted) return;
    setState(() {
      _errorMessage = null;
    });
    // 로그아웃 메시지 제거
    // ScaffoldMessenger.of(
    //   context,
    // ).showSnackBar(const SnackBar(content: Text('로그아웃되었습니다.')));
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AuthenticatedUser?>(
      valueListenable: _auth.userNotifier,
      builder: (context, user, _) {
        final bool isLoggedIn = user != null;

        if (isLoggedIn) {
          return Scaffold(
            backgroundColor: Colors.white,
            appBar: AppBar(
              backgroundColor: Colors.white,
              elevation: 0,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black),
                onPressed: widget.onBack,
              ),
              title: const Text('내 정보', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _LoggedInPanel(
                    user: user,
                    planDetails: _planDetails,
                    isPlanLoading: _isPlanLoading,
                    planError: _planError,
                    onRetryPlan: () => _fetchPlan(force: true),
                  ),
                  const SizedBox(height: 16),
                  _LoggedInMenu(
                    onProfile: _openProfileSettings,
                    onUsage: _openUsagePage,
                    onInquiry: _openInquiryPage,
                    onPlanGuide: _openPlanGuide,
                    onServiceInfo: _openServiceInfo,
                    onWebsite: _openWebsite,
                    onLogout: () {
                      if (_isBusy) return;
                      _handleLogout();
                    },
                  ),
                ],
              ),
            ),
          );
        }

        return Scaffold(
          // 메인 홈(HomePage)과 동일한 크림 톤
          backgroundColor: const Color(0xFFFDFBF7),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      onPressed: widget.onBack,
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black),
                    ),
                  ),
                  const SizedBox(height: 48),
                  
                  // Top Text
                  const Center(
                    child: Text(
                      '부엉 스피치',
                      style: TextStyle(
                        color: Color(0xFF5D4037),
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Center(
                    child: Text(
                      'AI 면접관과 스피킹!',
                      style: TextStyle(
                        color: Color(0xFF333333),
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  
                  // Character in the middle
                  Expanded(
                    child: Center(
                      child: Image.asset(
                        'assets/images/owl_character.png',
                        width: 340,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),

                  if (_errorMessage != null) ...[
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFB91C1C),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  
                  // Bottom Buttons (Apple을 앞에 두어 iOS·iPad 심사 환경에서 즉시 인지되도록)
                  if (_canShowAppleLogin) ...[
                    _SocialLoginButton(
                      leading: const _AppleLogoMark(width: 22, color: Colors.white),
                      label: 'Apple로 계속하기',
                      backgroundColor: Colors.black,
                      borderColor: Colors.transparent,
                      textColor: Colors.white,
                      onTap: _isBusy ? null : _handleAppleLogin,
                      isLoading: _isAppleLoading,
                    ),
                    const SizedBox(height: 12),
                  ],
                  _SocialLoginButton(
                    leading: _GoogleLogo(width: 22),
                    label: 'Google로 시작하기',
                    backgroundColor: const Color(0xFFF3F4F6),
                    borderColor: Colors.transparent,
                    textColor: const Color(0xFF1F2937),
                    onTap: _isBusy ? null : _handleGoogleLogin,
                    isLoading: _isGoogleLoading,
                  ),
                  const SizedBox(height: 12),
                  _SocialLoginButton(
                    leading: const _KakaoLogo(width: 20),
                    label: '카카오로 시작하기',
                    backgroundColor: const Color(0xFFFEE500),
                    borderColor: Colors.transparent,
                    textColor: const Color(0xFF191600),
                    onTap: _isBusy ? null : _handleKakaoLogin,
                    isLoading: _isKakaoLoading,
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SocialLoginButton extends StatelessWidget {
  const _SocialLoginButton({
    required this.leading,
    required this.label,
    required this.backgroundColor,
    required this.borderColor,
    required this.textColor,
    required this.onTap,
    this.isLoading = false,
  });

  final Widget leading;
  final String label;
  final Color backgroundColor;
  final Color borderColor;
  final Color textColor;
  final VoidCallback? onTap;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    final bool disabled = isLoading || onTap == null;

    return SizedBox(
      width: double.infinity,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 150),
        opacity: disabled ? 0.7 : 1.0,
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            onTap: disabled ? null : onTap,
            borderRadius: BorderRadius.circular(18),
            child: Container(
              decoration: BoxDecoration(
                color: backgroundColor,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: borderColor, width: borderColor == Colors.transparent ? 0 : 2),
                boxShadow: [
                  if (!disabled)
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 18,
                      offset: const Offset(0, 10),
                    ),
                ],
              ),
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
              child: Center(
                child:
                    isLoading
                        ? SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              textColor,
                            ),
                          ),
                        )
                        : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            leading,
                            const SizedBox(width: 10),
                            Text(
                              label,
                              style: TextStyle(
                                color: textColor,
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                          ],
                        ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoggedInPanel extends StatelessWidget {
  const _LoggedInPanel({
    required this.user,
    this.planDetails,
    this.isPlanLoading = false,
    this.planError,
    this.onRetryPlan,
  });

  final AuthenticatedUser user;
  final PlanDetails? planDetails;
  final bool isPlanLoading;
  final String? planError;
  final VoidCallback? onRetryPlan;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    final PlanDetails? currentPlan = planDetails;
    final _PlanStyle? planStyle =
        currentPlan != null
            ? _planStyles[currentPlan.planType] ?? _planStyles['basic']
            : null;
    final BoxDecoration decoration = BoxDecoration(
      color: planStyle?.cardGradient == null ? const Color(0xFFF3F4F6) : null,
      gradient:
          planStyle?.cardGradient == null
              ? null
              : LinearGradient(
                colors: planStyle!.cardGradient!,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: const Color(0xFFE5E7EB)),
    );
    final avatarText =
        (user.name ?? user.email ?? 'U').isNotEmpty
            ? (user.name ?? user.email ?? 'U')[0].toUpperCase()
            : 'U';

    return Container(
      decoration: decoration,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundImage:
                    user.avatarUrl != null
                        ? NetworkImage(user.avatarUrl!)
                        : null,
                child:
                    user.avatarUrl == null
                        ? Text(
                          avatarText,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        )
                        : null,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user.name ?? user.email ?? '로그인된 사용자',
                      style: theme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF111827),
                      ),
                    ),
                    if (user.email != null)
                      Text(
                        user.email!,
                        style: theme.bodySmall?.copyWith(
                          color: Colors.grey.shade600,
                        ),
                      ),
                    Text(
                      '로그인 방식: ${user.provider}',
                      style: theme.bodySmall?.copyWith(
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (isPlanLoading || planDetails != null || planError != null) ...[
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: _PlanIndicator(
                plan: planDetails,
                isLoading: isPlanLoading,
                error: planError,
                onRetry: onRetryPlan,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PlanIndicator extends StatelessWidget {
  const _PlanIndicator({
    required this.plan,
    required this.isLoading,
    required this.error,
    this.onRetry,
  });

  final PlanDetails? plan;
  final bool isLoading;
  final String? error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFE7E9F1),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: const [
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            SizedBox(width: 8),
            Text(
              '플랜 불러오는 중...',
              style: TextStyle(fontSize: 12, color: Color(0xFF4B5563)),
            ),
          ],
        ),
      );
    }

    if (error != null) {
      return TextButton.icon(
        onPressed: onRetry,
        icon: const Icon(Icons.refresh_rounded, size: 16),
        label: const Text(
          '플랜 다시 불러오기',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
        ),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          foregroundColor: const Color(0xFF2563EB),
        ),
      );
    }

    final PlanDetails? planDetails = plan;
    if (planDetails == null) {
      return const SizedBox.shrink();
    }

    return _PlanBadge(plan: planDetails);
  }
}

class _PlanBadge extends StatelessWidget {
  const _PlanBadge({required this.plan});

  final PlanDetails plan;

  @override
  Widget build(BuildContext context) {
    final _PlanStyle style =
        _planStyles[plan.planType] ?? _planStyles['basic']!;
    final String label =
        plan.displayName.contains('플랜')
            ? plan.displayName
            : '${plan.displayName} 플랜';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: style.colors,
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x22000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(style.icon, size: 16, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 12,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _PlanStyle {
  const _PlanStyle({
    required this.colors,
    required this.icon,
    this.cardGradient,
  });

  final List<Color> colors;
  final IconData icon;
  final List<Color>? cardGradient;
}

const Map<String, _PlanStyle> _planStyles = <String, _PlanStyle>{
  'basic': _PlanStyle(
    colors: <Color>[Color(0xFF60A5FA), Color(0xFF2563EB)],
    icon: Icons.auto_awesome_outlined,
    cardGradient: <Color>[Color(0xFFF5F9FF), Color(0xFFE6F0FF)],
  ),
  'standard': _PlanStyle(
    colors: <Color>[Color(0xFFF59E0B), Color(0xFFEA580C)],
    icon: Icons.star_half_rounded,
    cardGradient: <Color>[Color(0xFFFFF8EB), Color(0xFFFFEED6)],
  ),
  'pro': _PlanStyle(
    colors: <Color>[Color(0xFF8B5CF6), Color(0xFFEC4899)],
    icon: Icons.workspace_premium_rounded,
    cardGradient: <Color>[Color(0xFFF7F2FF), Color(0xFFFBE9F6)],
  ),
};

class _LoggedInMenu extends StatelessWidget {
  const _LoggedInMenu({
    required this.onProfile,
    required this.onUsage,
    required this.onInquiry,
    required this.onPlanGuide,
    required this.onServiceInfo,
    required this.onWebsite,
    required this.onLogout,
  });

  final VoidCallback onProfile;
  final VoidCallback onUsage;
  final VoidCallback onInquiry;
  final Future<void> Function() onPlanGuide;
  final VoidCallback onServiceInfo;
  final VoidCallback onWebsite;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      elevation: 3,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2, left: 4, right: 4),
            child: _MenuTile(
              icon: Icons.workspace_premium_rounded,
              label: '플랜/가격 안내',
              onTap: () {
                onPlanGuide();
              },
              background: const LinearGradient(
                colors: [
                  Color(0xFFB7A6FC),
                  Color(0xFFF3F0FF),
                  Color(0xFFBFE0FB),
                ],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
            ),
          ),
          const SizedBox(height: 4),
          _MenuTile(
            icon: Icons.person_outline_rounded,
            label: '프로필 설정',
            onTap: onProfile,
          ),
          const Divider(height: 1),
          _MenuTile(
            icon: Icons.bar_chart_rounded,
            label: '사용량',
            onTap: onUsage,
          ),
          const Divider(height: 1),
          _MenuTile(
            icon: Icons.chat_bubble_outline_rounded,
            label: '문의하기',
            onTap: onInquiry,
          ),
          const Divider(height: 1),
          _MenuTile(
            icon: Icons.info_outline_rounded,
            label: '서비스 정보',
            onTap: onServiceInfo,
          ),
          const Divider(height: 1),
          _MenuTile(
            icon: Icons.public_rounded,
            label: '웹사이트',
            onTap: onWebsite,
          ),
          const Divider(height: 1),
          _MenuTile(
            icon: Icons.logout_rounded,
            label: '로그아웃',
            onTap: onLogout,
            labelColor: const Color(0xFFE11D48),
            iconColor: const Color(0xFFE11D48),
          ),
        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.background,
    this.labelColor,
    this.iconColor,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Gradient? background;
  final Color? labelColor;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final content = ListTile(
      onTap: onTap,
      leading: Icon(icon, color: iconColor ?? Colors.black87),
      title: Text(
        label,
        style: const TextStyle(
          fontWeight: FontWeight.w600,
        ).copyWith(
          color: labelColor ?? Colors.black87,
        ),
      ),
      trailing: const Icon(Icons.chevron_right_rounded, color: Colors.black38),
    );

    if (background == null) {
      return content;
    }

    return Container(
      decoration: BoxDecoration(
        gradient: background,
        borderRadius: BorderRadius.circular(18),
      ),
      child: content,
    );
  }
}

class _TextField extends StatelessWidget {
  const _TextField({
    required this.controller,
    required this.label,
    required this.hintText,
    this.keyboardType,
    this.obscureText = false,
    this.validator,
    this.enabled = true,
    this.onChanged,
    this.suffixIcon,
    this.autofillHints,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String label;
  final String hintText;
  final TextInputType? keyboardType;
  final bool obscureText;
  final String? Function(String?)? validator;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final Widget? suffixIcon;
  final Iterable<String>? autofillHints;
  final TextInputAction? textInputAction;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Color(0xFF111827),
            decoration: TextDecoration.none,
          ),
        ),
        const SizedBox(height: 8),
        Material(
          color: Colors.transparent,
          child: TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText,
          validator: validator,
          enabled: enabled,
          onChanged: onChanged,
          autofillHints: autofillHints,
          textInputAction: textInputAction,
          style: const TextStyle(
            fontSize: 16,
            color: Color(0xFF111827),
          ),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: const TextStyle(
              fontSize: 16,
              color: Color(0xFF9CA3AF),
              fontWeight: FontWeight.normal,
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
              borderSide: const BorderSide(color: Colors.black, width: 1.8),
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
            suffixIcon: suffixIcon,
          ),
          ),
        ),
      ],
    );
  }
}

class _GoogleLogo extends StatelessWidget {
  const _GoogleLogo({required this.width});

  final double width;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.string(_googleSvg, width: width, height: width);
  }
}

class _KakaoLogo extends StatelessWidget {
  const _KakaoLogo({required this.width});

  final double width;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.string(_kakaoSvg, width: width, height: width);
  }
}

class _AppleLogoMark extends StatelessWidget {
  const _AppleLogoMark({required this.width, required this.color});

  final double width;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: width,
      child: CustomPaint(painter: AppleLogoPainter(color: color)),
    );
  }
}

const String _googleSvg = '''
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
</svg>
''';

const String _kakaoSvg = '''
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path fill="#000" d="M12 3C6.477 3 2 6.357 2 10.5c0 2.49 1.63 4.7 4.135 6.032L5.5 21l4.073-2.703c.806.127 1.65.203 2.427.203 5.523 0 10-3.357 10-7.5S17.523 3 12 3z"/>
</svg>
''';
