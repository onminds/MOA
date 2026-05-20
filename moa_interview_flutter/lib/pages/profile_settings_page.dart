import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../services/auth_service.dart';

class ProfileSettingsPage extends StatefulWidget {
  const ProfileSettingsPage({super.key});

  @override
  State<ProfileSettingsPage> createState() => _ProfileSettingsPageState();
}

class _ProfileSettingsPageState extends State<ProfileSettingsPage> {
  final AuthService _authService = AuthService.instance;
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final FocusNode _nameFocusNode;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  AuthenticatedUser? _user;
  bool _isEditing = false;
  bool _isSaving = false;
  String? _localAvatarAsset;

  @override
  void initState() {
    super.initState();
    _loadLocalAvatar();
    _nameFocusNode = FocusNode();
    _user = _authService.currentUser;
    _nameController = TextEditingController(text: _user?.name ?? '');
    _emailController = TextEditingController(text: _user?.email ?? '');
    _authService.userNotifier.addListener(_handleUserChanged);
  }

  void _handleUserChanged() {
    final updatedUser = _authService.userNotifier.value;
    if (!mounted) return;
    setState(() {
      _user = updatedUser;
      if (!_isEditing) {
        _nameController.text = updatedUser?.name ?? '';
      }
      _emailController.text = updatedUser?.email ?? '';
    });
  }

  Future<void> _loadLocalAvatar() async {
    final path = await _storage.read(key: 'local_avatar_path');
    if (mounted) {
      setState(() {
        _localAvatarAsset = path ?? 'assets/images/profile_owl_1.png';
      });
    }
  }

  @override
  void dispose() {
    _authService.userNotifier.removeListener(_handleUserChanged);
    _nameController.dispose();
    _emailController.dispose();
    _nameFocusNode.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_isEditing) {
      setState(() {
        _isEditing = true;
      });
      await Future.delayed(const Duration(milliseconds: 100));
      if (!_nameFocusNode.hasFocus) {
        _nameFocusNode.requestFocus();
      }
      return;
    }

    final currentUser = _user;
    if (currentUser == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('로그인 정보가 없습니다. 다시 로그인해주세요.')),
      );
      return;
    }

    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이름을 입력해주세요.')),
      );
      _nameFocusNode.requestFocus();
      return;
    }

    if (name.length > 50) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('이름은 50자 이하로 입력해주세요.')),
      );
      _nameFocusNode.requestFocus();
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      await _authService.updateProfile(name: name);
      if (!mounted) return;
      setState(() {
        _isEditing = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('프로필이 저장되었습니다.')),
      );
    } on AuthException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('프로필 저장 중 문제가 발생했습니다. ($error)')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _user;
    if (user == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF7F8FA),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded),
            onPressed: () => Navigator.of(context).pop(),
          ),
          title: const Text('프로필 설정'),
        ),
        body: const Center(
          child: Text('로그인이 필요합니다. 다시 로그인해주세요.'),
        ),
      );
    }

    final theme = Theme.of(context);
    final avatarUrl = _authService.profileImageUrlWithCacheBust ?? user.avatarUrl;
    final ImageProvider<Object>? avatar =
        (avatarUrl != null && avatarUrl.isNotEmpty)
            ? NetworkImage(avatarUrl)
            : null;
    final initials = _buildInitials(user.name, user.email);

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('프로필 설정'),
        centerTitle: false,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 24,
                      offset: Offset(0, 12),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '프로필 사진',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '앱에서는 프로필 사진을 변경할 수 없습니다. 소셜 로그인 시 제공된 이미지가 표시될 수 있습니다.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 42,
                          backgroundColor: const Color(0xFFE5E7EB),
                          backgroundImage: AssetImage(_localAvatarAsset ?? 'assets/images/profile_owl_1.png'),
                          child: null,
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),
                    _buildLabel(theme.textTheme, '이름'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _nameController,
                      focusNode: _nameFocusNode,
                      readOnly: !_isEditing,
                      textInputAction: TextInputAction.done,
                      maxLength: 50,
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: '이름을 입력하세요',
                        filled: true,
                        fillColor: _isEditing ? Colors.white : const Color(0xFFF3F4F6),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                            color: _isEditing ? Colors.black : const Color(0xFFE5E7EB),
                            width: _isEditing ? 1.6 : 1,
                          ),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                        suffixIcon: _isEditing
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded),
                                onPressed: () {
                                  _nameController.clear();
                                  _nameFocusNode.requestFocus();
                                },
                              )
                            : null,
                      ),
                    ),
                    const SizedBox(height: 20),
                    _buildLabel(theme.textTheme, '이메일'),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _emailController,
                      readOnly: true,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0xFFF3F4F6),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 14,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '이메일은 변경할 수 없습니다.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.grey[500],
                      ),
                    ),
                    const SizedBox(height: 28),
                    FilledButton(
                      onPressed: _isSaving ? null : _handleSave,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        backgroundColor: Colors.black,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                      child: _isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(_isEditing ? '저장하기' : '편집하기'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              // 계정 삭제 섹션
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x14000000),
                      blurRadius: 24,
                      offset: Offset(0, 12),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '계정 관리',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '계정 삭제',
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFFDC2626),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '계정을 삭제하면 모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다. 진행하기 전에 신중히 고려해 주세요.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton(
                      onPressed: _handleDeleteAccount,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(48),
                        foregroundColor: const Color(0xFFDC2626),
                        side: const BorderSide(color: Color(0xFFDC2626)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                      ),
                      child: const Text('계정 삭제'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handleDeleteAccount() async {
    // 확인 다이얼로그 표시
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        title: const Text(
          '계정 삭제 확인',
          style: TextStyle(
            fontWeight: FontWeight.w700,
          ),
        ),
        content: const Text(
          '정말로 계정을 삭제하시겠습니까?\n\n'
          '이 작업은 되돌릴 수 없으며, 다음 항목이 영구적으로 삭제됩니다:\n'
          '• 프로필 정보\n'
          '• 생성한 콘텐츠\n'
          '• 사용 내역\n'
          '• 구독 정보\n\n'
          '삭제 후에는 복구가 불가능합니다.',
          style: TextStyle(height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFFDC2626),
            ),
            child: const Text(
              '삭제',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    // 로딩 다이얼로그 표시
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(),
      ),
    );

    try {
      await _authService.deleteAccount();
      if (!mounted) return;

      // 로딩 다이얼로그 닫기
      Navigator.of(context).pop();

      // 성공 메시지 표시 및 로그인 페이지로 이동
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('계정이 성공적으로 삭제되었습니다.')),
      );

      // 로그인 페이지로 이동 (스택 초기화)
      Navigator.of(context).pushNamedAndRemoveUntil('/', (route) => false);
    } on AuthException catch (error) {
      if (!mounted) return;
      Navigator.of(context).pop(); // 로딩 다이얼로그 닫기
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (error) {
      if (!mounted) return;
      Navigator.of(context).pop(); // 로딩 다이얼로그 닫기
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('계정 삭제 중 문제가 발생했습니다. ($error)')),
      );
    }
  }

  Widget _buildLabel(TextTheme textTheme, String label) {
    return Text(
      label,
      style: textTheme.titleSmall?.copyWith(
        fontWeight: FontWeight.w700,
        color: const Color(0xFF111827),
      ),
    );
  }

  String _buildInitials(String? name, String? email) {
    final source = (name ?? email ?? '').trim();
    if (source.isEmpty) {
      return 'M';
    }

    final parts = source.split(RegExp(r'\s+')).take(2).toList();
    if (parts.isEmpty) {
      return source.substring(0, 1).toUpperCase();
    }

    final buffer = StringBuffer();
    for (final part in parts) {
      if (part.isEmpty) continue;
      buffer.write(part[0].toUpperCase());
      if (buffer.length >= 2) break;
    }

    final result = buffer.toString();
    return result.isEmpty ? source.substring(0, 1).toUpperCase() : result;
  }
}

