import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../services/contact_service.dart';

class InquiryPage extends StatefulWidget {
  const InquiryPage({super.key});

  @override
  State<InquiryPage> createState() => _InquiryPageState();
}

class _InquiryPageState extends State<InquiryPage> {
  final AuthService _auth = AuthService.instance;
  final ContactService _contactService = ContactService.instance;

  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  final TextEditingController _subjectController = TextEditingController();
  final TextEditingController _messageController = TextEditingController();
  final FocusNode _nameFocusNode = FocusNode();
  final FocusNode _emailFocusNode = FocusNode();
  final FocusNode _subjectFocusNode = FocusNode();
  final FocusNode _messageFocusNode = FocusNode();

  bool _isSubmitting = false;
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    final user = _auth.currentUser;
    final name = user?.name;
    final email = user?.email;
    final initialName =
        (name != null && name.trim().isNotEmpty)
            ? name.trim()
            : (email != null && email.trim().isNotEmpty
                ? email.split('@').first
                : 'MOA 사용자');

    _nameController = TextEditingController(text: initialName);
    _emailController = TextEditingController(text: email ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _subjectController.dispose();
    _messageController.dispose();
    _nameFocusNode.dispose();
    _emailFocusNode.dispose();
    _subjectFocusNode.dispose();
    _messageFocusNode.dispose();
    super.dispose();
  }

  Future<void> _submitInquiry() async {
    final user = _auth.currentUser;
    if (user == null) {
      _showSnackBar('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    if (!_formKey.currentState!.validate()) {
      return;
    }

    FocusScope.of(context).unfocus();

    setState(() {
      _isSubmitting = true;
      _statusMessage = null;
    });

    try {
      final name = _nameController.text.trim();
      final email = _emailController.text.trim();

      await _contactService.submitInquiry(
        name: name.isEmpty ? 'MOA 사용자' : name,
        email: email,
        subject: _subjectController.text.trim(),
        message: _messageController.text.trim(),
      );

      if (!mounted) return;

      setState(() {
        _statusMessage = '문의가 접수되었습니다. 빠르게 답변드릴게요!';
        _subjectController.clear();
        _messageController.clear();
      });

      _showSnackBar('문의가 성공적으로 전송되었습니다.');
    } on ContactException catch (error) {
      if (!mounted) return;
      setState(() {
        _statusMessage = error.message;
      });
      _showSnackBar(error.message, isError: true);
    } catch (_) {
      if (!mounted) return;
      const message = '문의 전송 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
      setState(() {
        _statusMessage = message;
      });
      _showSnackBar(message, isError: true);
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
        backgroundColor: isError ? Colors.redAccent : Colors.black87,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _auth.currentUser;

    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        backgroundColor: const Color(0xFFFDFBF7),
        elevation: 0,
        title: const Text(
          '문의하기',
          style: TextStyle(
            color: Color(0xFF4E342E),
            fontWeight: FontWeight.w900,
            fontSize: 20,
            letterSpacing: -0.5,
          ),
        ),
        centerTitle: false,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF4E342E)),
          onPressed: () => Navigator.of(context).pop(),
          tooltip: '뒤로가기',
        ),
      ),
      body:
          user == null
              ? _buildLoggedOutMessage()
              : SafeArea(
                child: SingleChildScrollView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '궁금한 점이 있으시면 언제든지 문의해주세요.',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF4E342E),
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '보통 24시간 이내에 답변을 드리고 있으며, 문의 내용은 등록된 이메일로 전달됩니다.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF8D6E63),
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 20),
                      _buildForm(user),
                      if (_statusMessage != null) ...[
                        const SizedBox(height: 20),
                        _StatusMessage(message: _statusMessage!),
                      ],
                    ],
                  ),
                ),
              ),
    );
  }

  Widget _buildLoggedOutMessage() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Icon(
              Icons.lock_outline_rounded,
              size: 48,
              color: Colors.grey,
            ),
            const SizedBox(height: 16),
            Text(
              '문의 기능을 이용하려면 로그인이 필요합니다. 다시 로그인해주세요.',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm(AuthenticatedUser user) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFEFEBE9), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF8D6E63).withValues(alpha: 0.05),
            blurRadius: 15,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '문의 내용 작성',
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Color(0xFF4E342E),
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nameController,
              focusNode: _nameFocusNode,
              decoration: _inputDecoration('이름을 입력해주세요'),
              textInputAction: TextInputAction.next,
              maxLength: 50,
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
              validator: (String? value) {
                if (value == null || value.trim().isEmpty) {
                  return '이름을 입력해주세요.';
                }
                if (value.trim().length < 2) {
                  return '이름은 2자 이상 입력해주세요.';
                }
                return null;
              },
              onFieldSubmitted: (_) {
                _emailFocusNode.requestFocus();
              },
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _emailController,
              focusNode: _emailFocusNode,
              decoration: _inputDecoration('답변 받을 이메일 주소를 입력해주세요'),
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              validator: (String? value) {
                if (value == null || value.trim().isEmpty) {
                  return '이메일을 입력해주세요.';
                }
                final emailRegex = RegExp(r'^[\w\.-]+@[\w\.-]+\.[A-Za-z]{2,}$');
                if (!emailRegex.hasMatch(value.trim())) {
                  return '올바른 이메일 형식이 아닙니다.';
                }
                return null;
              },
              onFieldSubmitted: (_) {
                _subjectFocusNode.requestFocus();
              },
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _subjectController,
              focusNode: _subjectFocusNode,
              decoration: _inputDecoration('제목을 입력해주세요'),
              textInputAction: TextInputAction.next,
              maxLength: 80,
              validator: (String? value) {
                if (value == null || value.trim().isEmpty) {
                  return '제목을 입력해주세요.';
                }
                if (value.trim().length < 3) {
                  return '제목은 3자 이상 입력해주세요.';
                }
                return null;
              },
              onFieldSubmitted: (_) {
                _messageFocusNode.requestFocus();
              },
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _messageController,
              focusNode: _messageFocusNode,
              decoration: _inputDecoration('문의하실 내용을 자세히 작성해주세요'),
              minLines: 4,
              maxLines: 8,
              maxLength: 1200,
              validator: (String? value) {
                if (value == null || value.trim().isEmpty) {
                  return '문의 내용을 입력해주세요.';
                }
                if (value.trim().length < 10) {
                  return '문의 내용은 10자 이상 입력해주세요.';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _isSubmitting ? null : _submitInquiry,
                icon:
                    _isSubmitting
                        ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                        : const Icon(Icons.send_rounded, size: 20),
                label: Text(
                  _isSubmitting ? '전송 중...' : '문의 보내기',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF5D4037),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: const TextStyle(color: Color(0xFFBCAAA4), fontSize: 14),
      counterText: '',
      filled: true,
      fillColor: const Color(0xFFFDFBF7),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFEFEBE9)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFEFEBE9)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFF8D6E63), width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colors.redAccent),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Colors.redAccent, width: 1.5),
      ),
    );
  }
}

class _StatusMessage extends StatelessWidget {
  const _StatusMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final isSuccess = message.contains('성공') || message.contains('접수');
    final backgroundColor =
        isSuccess ? const Color(0xFFE8F5E9) : const Color(0xFFFFEBEE);
    final borderColor =
        isSuccess ? const Color(0xFF81C784) : const Color(0xFFEF9A9A);
    final textColor =
        isSuccess ? const Color(0xFF2E7D32) : const Color(0xFFC62828);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          Icon(
            isSuccess
                ? Icons.check_circle_rounded
                : Icons.error_outline_rounded,
            color: textColor,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: textColor, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
