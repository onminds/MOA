import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../services/auth_service.dart';
import 'login_page.dart';
import 'inquiry_page.dart';
import 'usage_page.dart';
import 'notice_page.dart';
import 'privacy_policy_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  String _appVersion = '1.0.21';
  String? _localAvatarAsset;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  @override
  void initState() {
    super.initState();
    _loadLocalAvatar();
    AuthService.instance.userNotifier.addListener(_onUserChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final isIos = Theme.of(context).platform == TargetPlatform.iOS;
      setState(() {
        _appVersion = '1.0.21 (${isIos ? 'iOS' : 'Android'})';
      });
    });
  }

  void _onUserChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _loadLocalAvatar() async {
    final path = await _storage.read(key: 'local_avatar_path');
    if (mounted) {
      setState(() {
        _localAvatarAsset = path ?? 'assets/images/profile_owl_1.png';
      });
    }
  }

  Future<void> _saveLocalAvatar(String path) async {
    await _storage.write(key: 'local_avatar_path', value: path);
    if (mounted) {
      setState(() {
        _localAvatarAsset = path;
      });
    }
  }



  @override
  void dispose() {
    AuthService.instance.userNotifier.removeListener(_onUserChanged);
    super.dispose();
  }

  String _displayNameForGreeting(AuthenticatedUser? user) {
    if (user == null) return 'GUEST';
    final n = user.name?.trim();
    if (n != null && n.isNotEmpty) return n;
    final e = user.email;
    if (e != null && e.isNotEmpty) return e.split('@').first;
    return 'GUEST';
  }

  String _initials(AuthenticatedUser? user) {
    final n = user?.name?.trim();
    if (n != null && n.isNotEmpty) {
      return n.length >= 2 ? n.substring(0, 2) : n.substring(0, 1);
    }
    final e = user?.email;
    if (e != null && e.isNotEmpty) {
      return e.substring(0, 1).toUpperCase();
    }
    return '?';
  }

  void _handleLogout() async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('로그아웃'),
        content: const Text('정말 로그아웃 하시겠습니까?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('로그아웃', style: TextStyle(color: Color(0xFF5D4037))),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    await AuthService.instance.logout();
    if (mounted) {
      Navigator.of(context, rootNavigator: true).pushAndRemoveUntil<void>(
        MaterialPageRoute<void>(
          builder:
              (_) => LoginPage(
                onBack: () {},
                restartAppShellOnSuccess: true,
              ),
        ),
        (route) => false,
      );
    }
  }

  void _handleDeleteAccount() async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('회원 탈퇴'),
        content: const Text('정말 탈퇴하시겠습니까?\n기존 연습 기록과 데이터가 모두 삭제됩니다.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('탈퇴', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await AuthService.instance.deleteAccount();
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pushAndRemoveUntil<void>(
          MaterialPageRoute<void>(
            builder:
                (_) => LoginPage(
                  onBack: () {},
                  restartAppShellOnSuccess: true,
                ),
          ),
          (route) => false,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('탈퇴 실패: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthService.instance.currentUser;
    final avatarUrl = AuthService.instance.profileImageUrlWithCacheBust ??
        user?.avatarUrl;

    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFDFBF7),
        elevation: 0,
        title: const Text(
          '마이페이지',
          style: TextStyle(
            color: Color(0xFF4E342E), // Dark brown
            fontWeight: FontWeight.w900,
            fontSize: 24,
            letterSpacing: -0.5,
          ),
        ),
        centerTitle: false,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Profile Card
              Container(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFFF8E1), Color(0xFFFFECB3)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.3)),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFFFD54F).withValues(alpha: 0.15),
                      blurRadius: 15,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${_displayNameForGreeting(user)}님!',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF4E342E),
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          const Text(
                            '오늘도 부엉 스피치와 함께\n면접준비 화이팅!',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF8D6E63),
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    GestureDetector(
                      onTap: _showAvatarSelectionDialog,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          CircleAvatar(
                            radius: 46, // Increased radius
                            backgroundColor: const Color(0xFF8D6E63),
                            backgroundImage: AssetImage(_localAvatarAsset ?? 'assets/images/profile_owl_1.png'),
                            child: null,
                          ),
                          Positioned(
                            bottom: 2,
                            right: 2,
                            child: Container(
                              padding: const EdgeInsets.all(5),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0xFFEFEBE9), width: 1.5),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.1),
                                    blurRadius: 4,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: const Icon(
                                Icons.edit_rounded,
                                size: 16,
                                color: Color(0xFF8D6E63),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Menu List
              _buildMenuItem('공지사항', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NoticePage()))),
              _buildMenuItem('문의 하기', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const InquiryPage()))),
              _buildMenuItem('이용 방법', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const UsagePage()))),
              _buildMenuItem('개인정보 처리방침', () => Navigator.push(context, MaterialPageRoute(builder: (_) => const PrivacyPolicyPage()))),

              const SizedBox(height: 48),

              // Bottom Actions (Logout & Withdraw)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildPillButton('로그아웃', _handleLogout),
                  const SizedBox(width: 12),
                  _buildPillButton('회원 탈퇴', _handleDeleteAccount, isDestructive: true),
                ],
              ),

              const SizedBox(height: 24),

              // App Version
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFEBE9),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: Text(
                    '앱 버전 $_appVersion',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF8D6E63),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 48), // Added bottom padding
            ],
          ),
        ),
      ),
    );
  }

  void _showAvatarSelectionDialog() {
    final List<String> avatars = [
      'assets/images/profile_owl_1.png',
      'assets/images/profile_owl_2.png',
      'assets/images/profile_owl_3.png',
      'assets/images/profile_owl_4.png',
      'assets/images/profile_owl_5.png',
    ];

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFFFDFBF7),
          title: const Text('프로필 사진 선택', style: TextStyle(color: Color(0xFF4E342E), fontWeight: FontWeight.bold, fontSize: 18)),
          content: SizedBox(
            width: double.maxFinite,
            child: GridView.builder(
              shrinkWrap: true,
              itemCount: avatars.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemBuilder: (context, index) {
                final assetPath = avatars[index];
                return GestureDetector(
                  onTap: () {
                    _saveLocalAvatar(assetPath);
                    Navigator.pop(context);
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: (_localAvatarAsset ?? 'assets/images/profile_owl_1.png') == assetPath 
                            ? const Color(0xFF8D6E63) 
                            : const Color(0xFFEFEBE9), 
                        width: 3
                      ),
                      image: DecorationImage(
                        image: AssetImage(assetPath),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('닫기', style: TextStyle(color: Color(0xFF8D6E63), fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  Widget _buildMenuItem(String title, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 15,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF4E342E),
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: Color(0xFFD7CCC8), size: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPillButton(String title, VoidCallback onTap, {bool isDestructive = false}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: isDestructive ? const Color(0xFFFFF6F6) : const Color(0xFFF5F5F5),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          title,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: isDestructive ? const Color(0xFFD32F2F) : const Color(0xFF9E9E9E),
          ),
        ),
      ),
    );
  }
}
