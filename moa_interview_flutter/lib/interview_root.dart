import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'pages/home_page.dart';
import 'pages/login_page.dart';
import 'pages/post_login_setup_page.dart';
import 'services/auth_service.dart';

/// 로그인되지 않았을 때는 **첫 화면으로 로그인**만 표시.
/// 로그인 후에는 닉네임/회사 분석 온보딩을 먼저 완료한 뒤 홈으로 진입한다.
class InterviewRoot extends StatelessWidget {
  const InterviewRoot({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthService.instance;
    return ListenableBuilder(
      listenable: auth.userNotifier,
      builder: (context, _) {
        if (!auth.isLoggedIn) {
          return LoginPage(
            onBack: () {
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
              } else if (Platform.isAndroid || Platform.isIOS) {
                SystemNavigator.pop();
              }
            },
          );
        }
        return _AuthenticatedFlow(user: auth.currentUser);
      },
    );
  }
}

class _AuthenticatedFlow extends StatefulWidget {
  const _AuthenticatedFlow({required this.user});

  final AuthenticatedUser? user;

  @override
  State<_AuthenticatedFlow> createState() => _AuthenticatedFlowState();
}

class _AuthenticatedFlowState extends State<_AuthenticatedFlow> {
  bool _isLoading = true;
  bool _isSetupCompleted = false;

  @override
  void initState() {
    super.initState();
    _loadSetupStatus();
  }

  @override
  void didUpdateWidget(covariant _AuthenticatedFlow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user?.id != widget.user?.id ||
        oldWidget.user?.name != widget.user?.name) {
      _loadSetupStatus();
    }
  }

  Future<void> _loadSetupStatus() async {
    setState(() {
      _isLoading = true;
    });

    final completed = await PostLoginSetupPage.isCompleted(widget.user?.id);
    final hasNickname = (widget.user?.name ?? '').trim().isNotEmpty;

    if (!mounted) return;
    setState(() {
      _isSetupCompleted = completed && hasNickname;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (!_isSetupCompleted) {
      return PostLoginSetupPage(
        onComplete: () {
          if (!mounted) return;
          setState(() {
            _isSetupCompleted = true;
          });
        },
      );
    }

    return const HomePage();
  }
}
