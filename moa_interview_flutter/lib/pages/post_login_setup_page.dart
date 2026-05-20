import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../services/auth_service.dart';
import '../services/interview_prep_setup_cache.dart';
import '../widgets/company_analysis_edit_dialogs.dart';
import 'dart:ui';
import 'package:lottie/lottie.dart';

/// STEP 4 — 직무 설명 필드 도움말 (면접 코치 톤)
const String _kJobDescriptionHelpBody = '''
이 칸은 “선택”이지만, 적어 두면 AI가 질문의 초점을 훨씬 맞출 수 있습니다. 채용공고에 나온 문장을 그대로 붙여 넣어도 좋고, 아래처럼 요약해도 됩니다.

【무엇을 적으면 좋은가요?】
• 맡게 될 업무의 핵심(예: 문서·일정·경비·고객 응대·데이터 정리 등)
• 함께 일하는 팀·협업 대상(내부 부서, 외부 고객사 등)
• 자주 쓰는 도구(Excel, 사내 시스템, 영어 메일 등)
• 우대·필수 자격(자격증, 언어, 경력 연차 등)

【왜 필요한가요?】
면접관은 “이 직무에서 무엇을 잘해야 하는 사람인가”를 기준으로 질문을 만듭니다. 공고에 가깝게 적을수록, 연습 질문이 실제 면접과 비슷해집니다.

【작성 예시(사무·행정 직무)】
「입사 후 사업지원팀에서 계약서 검토·경비 정산·법인카드 관리·회의 일정 조율을 담당합니다. 영업·구매 담당자와 주 2~3회 협업 미팅에 참석하고, 월말 실적 집계 보고서를 Excel로 작성합니다. OA 활용능력(Excel 함수·피벗), 기본 영어 이메일 회신이 가능한 분을 우대합니다. 신입도 지원 가능하나, 인턴·아르바이트로 사무 경험이 있으면 가산점입니다.」

위처럼 “무슨 일을 하는지, 누구와 일하는지, 무엇이 중요한지”만 드러나면 충분합니다. 길이는 공고 길이에 맞추되, 빈칸이면 AI가 일반적인 질문 위주로만 만들 수 있어요.''';

/// STEP 4 — 주요 경험 필드 도움말 (면접 코치 톤)
const String _kExperienceHelpBody = '''
이 칸은 “필수”입니다. 면접에서 가장 많이 묻는 것은 “당신의 경험이 지원 직무와 어떻게 연결되는가”입니다. 아래 원칙만 지키면, AI도 그 연결을 반영해 질문을 만듭니다.

【이렇게 쓰면 좋아요】
1) 지원 직무와 연결되는 경험만 골라 쓰기 (학교·인턴·동아리·대외활동·이전 직장 모두 가능)
2) 가능하면 숫자·기간·역할을 넣기 (예: 3개월, 5명 팀, 20% 개선)
3) 한 줄에 한 경험씩. 문장이 길어지면 줄을 나누기

【면접관이 듣고 싶어 하는 것】
• 상황(Situation): 어떤 배경이었는지
• 과제(Task): 나에게 맡겨진 역할
• 행동(Action): 내가 실제로 한 일
• 결과(Result): 성과·배운 점(가능하면 수치)

꼭 완벽한 성과가 아니어도 됩니다. “부족했지만 이렇게 보완했다”도 좋은 스토리입니다.

【작성 예시(신입·사무 지원 지원 가정)】
「• OO대 ‘캠퍼스-기업 연계 프로젝트’(4주): 팀장으로 일정 조율·회의록 작성. 3회 미팅 성사 후 제안서 제출까지 완료.
• XX센터 사무 보조 아르바이트(6개월): 방문 민원 응대·서류 접수. 하루 평균 15건 처리, 민원 처리 시간 단축을 위해 접수 양식을 정리해 팀에 공유.
• 동아리 총무(1년): 예산 400만 원 규모 수입·지출 장부 관리. 학기말 감사 시 지적 없이 마감.
• Excel: 피벗·VLOOKUP로 동아리 행사비 집계 시간을 회당 2시간에서 40분으로 단축.」

위 예시처럼 “역할 + 행동 + 결과(또는 배운 점)”가 보이면 충분합니다. 처음에는 짧게라도 적고, 나중에 숫자만 보태도 효과가 큽니다.''';

class PostLoginSetupPage extends StatefulWidget {
  const PostLoginSetupPage({super.key, required this.onComplete});

  final VoidCallback onComplete;

  static Future<bool> isCompleted(String? userId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_storageKey(userId)) ?? false;
  }

  static String _storageKey(String? userId) {
    return 'post_login_setup_completed_${userId ?? "guest"}';
  }

  @override
  State<PostLoginSetupPage> createState() => _PostLoginSetupPageState();
}

enum _SetupStep { nickname, profile, analysis, detail }

class _PostLoginSetupPageState extends State<PostLoginSetupPage> {
  final AuthService _auth = AuthService.instance;
  final TextEditingController _nicknameController = TextEditingController();
  final TextEditingController _companyNameController = TextEditingController();
  final TextEditingController _jobTitleController = TextEditingController();
  final TextEditingController _skillsController = TextEditingController();

  /// 면접 준비 [InterviewPrepPage]의 `careerLevel`과 동일 (`junior` / `mid` / `senior`)
  String _careerLevel = 'junior';

  final TextEditingController _jobDescriptionController = TextEditingController();
  final TextEditingController _experienceDetailController = TextEditingController();

  _SetupStep _currentStep = _SetupStep.nickname;
  bool _isSavingNickname = false;
  bool _isAnalyzingCompany = false;
  bool _isCompleting = false;
  String? _errorMessage;
  Map<String, dynamic>? _companyAnalysis;
  final ScrollController _analysisScrollController = ScrollController();
  bool _showAnalysisScrollFab = true;

  @override
  void initState() {
    super.initState();
    _analysisScrollController.addListener(_updateAnalysisScrollFabVisibility);
    final user = _auth.currentUser;
    final fallbackName = user?.email?.split('@').first ?? '';
    _nicknameController.text =
        (user?.name ?? '').trim().isNotEmpty
            ? user!.name!.trim()
            : fallbackName;
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _companyNameController.dispose();
    _jobTitleController.dispose();
    _skillsController.dispose();
    _jobDescriptionController.dispose();
    _experienceDetailController.dispose();
    _analysisScrollController.removeListener(_updateAnalysisScrollFabVisibility);
    _analysisScrollController.dispose();
    super.dispose();
  }

  void _updateAnalysisScrollFabVisibility() {
    if (!mounted || _currentStep != _SetupStep.analysis) return;
    if (!_analysisScrollController.hasClients) return;
    final position = _analysisScrollController.position;
    final maxExtent = position.maxScrollExtent;
    final atBottom = maxExtent <= 0 || position.pixels >= maxExtent - 12;
    final shouldShow = !atBottom;
    if (_showAnalysisScrollFab != shouldShow) {
      setState(() => _showAnalysisScrollFab = shouldShow);
    }
  }

  void _scrollAnalysisToBottom() {
    void scroll() {
      if (!_analysisScrollController.hasClients) return;
      final maxExtent = _analysisScrollController.position.maxScrollExtent;
      _analysisScrollController.animateTo(
        maxExtent,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
      );
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      scroll();
    });
  }

  static String _careerLevelLabel(String level) {
    switch (level) {
      case 'mid':
        return '미드레벨';
      case 'senior':
        return '시니어';
      default:
        return '신입/주니어';
    }
  }

  Widget _buildCareerLevelButton(String level, String label) {
    final isSelected = _careerLevel == level;
    return InkWell(
      onTap: () {
        setState(() {
          _careerLevel = level;
        });
      },
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFFEF3C7) : Colors.white,
          border: Border.all(
            color: isSelected ? const Color(0xFFF59E0B) : const Color(0xFFE5E7EB),
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isSelected ? const Color(0xFFBE185D) : const Color(0xFF6B7280),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _saveNicknameAndContinue() async {
    final nickname = _nicknameController.text.trim();
    if (nickname.isEmpty) {
      setState(() {
        _errorMessage = '닉네임을 입력해주세요.';
      });
      return;
    }

    setState(() {
      _isSavingNickname = true;
      _errorMessage = null;
    });

    try {
      final currentName = (_auth.currentUser?.name ?? '').trim();
      if (currentName != nickname) {
        await _auth.updateProfile(name: nickname);
      }

      if (!mounted) return;
      setState(() {
        _currentStep = _SetupStep.profile;
      });
    } on AuthException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '닉네임 저장 중 문제가 발생했습니다.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSavingNickname = false;
        });
      }
    }
  }

  Future<void> _analyzeCompanyAndContinue() async {
    final companyName = _companyNameController.text.trim();
    final jobTitle = _jobTitleController.text.trim();

    if (companyName.isEmpty || jobTitle.isEmpty) {
      setState(() {
        _errorMessage = '회사명과 지원 직무를 모두 입력해주세요.';
      });
      return;
    }

    FocusScope.of(context).unfocus();

    setState(() {
      _isAnalyzingCompany = true;
      _errorMessage = null;
    });

    try {
      await _auth.restoreSession();
      await _auth.ensureFreshToken();

      final response = await _auth.client.post<Map<String, dynamic>>(
        '/api/interview-prep/analyze-company',
        data: <String, dynamic>{
          'companyName': companyName,
          'jobTitle': jobTitle,
          'careerLevel': _careerLevel,
        },
        options: Options(
          headers: const <String, String>{
            'X-Requested-With': 'moa_interview_flutter',
          },
        ),
      );

      final data = response.data;
      final success = data?['success'] == true;
      final analysis = data?['companyAnalysis'];

      if (!success || analysis is! Map<String, dynamic>) {
        throw Exception('회사 분석 결과를 불러오지 못했습니다.');
      }

      if (!mounted) return;
      setState(() {
        _companyAnalysis = InterviewPrepSetupCache.normalizeCompanyAnalysis(
          Map<String, dynamic>.from(analysis),
        );
        _currentStep = _SetupStep.analysis;
        _showAnalysisScrollFab = true;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _updateAnalysisScrollFabVisibility();
      });
    } on DioException catch (error) {
      if (!mounted) return;
      final message =
          error.response?.data is Map && error.response?.data['error'] is String
              ? error.response?.data['error'] as String
              : '회사 분석 중 오류가 발생했습니다.';
      setState(() {
        _errorMessage = message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '회사 분석 중 오류가 발생했습니다.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isAnalyzingCompany = false;
        });
      }
    }
  }

  Future<void> _completeSetup() async {
    if (_experienceDetailController.text.trim().isEmpty) {
      setState(() {
        _errorMessage = '주요 경험 및 프로젝트를 입력해주세요.';
      });
      return;
    }

    setState(() {
      _isCompleting = true;
      _errorMessage = null;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(
        PostLoginSetupPage._storageKey(_auth.currentUser?.id),
        true,
      );

      final analysis = _companyAnalysis;
      final baseAnalysis = (analysis != null && analysis.isNotEmpty)
          ? Map<String, dynamic>.from(analysis)
          : <String, dynamic>{};
      await InterviewPrepSetupCache.save(
        _auth.currentUser?.id,
        companyName: _companyNameController.text.trim(),
        jobTitle: _jobTitleController.text.trim(),
        experienceLevel: _careerLevel,
        skills: _skillsController.text.trim(),
        jobDescription: _jobDescriptionController.text.trim(),
        experience: _experienceDetailController.text.trim(),
        companyAnalysis: InterviewPrepSetupCache.normalizeCompanyAnalysis(
          baseAnalysis,
        ),
      );

      if (!mounted) return;
      widget.onComplete();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '설정 완료 처리에 실패했습니다.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isCompleting = false;
        });
      }
    }
  }

  List<String> _stringList(dynamic value) {
    if (value is! List) return const <String>[];
    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  String _stringValue(dynamic value) {
    return value?.toString().trim() ?? '';
  }

  Future<void> _showEditListField(
    String key,
    String title,
    Color chipBackgroundColor,
    Color chipTextColor,
  ) async {
    final map = _companyAnalysis;
    if (map == null) return;
    final list = _stringList(map[key]);
    final result = await showDialog<List<String>?>(
      context: context,
      builder:
          (ctx) => EditListBadgesDialog(
            title: title,
            initialItems: list,
            chipBackgroundColor: chipBackgroundColor,
            chipTextColor: chipTextColor,
          ),
    );
    if (result == null || !mounted) return;
    // 다이얼로그 라우트 dispose 직후 동기 setState와 겹치지 않게 한 프레임 뒤에 갱신
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        map[key] = result;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _updateAnalysisScrollFabVisibility();
      });
    });
  }

  Future<void> _showEditTextField(String key, String title) async {
    final map = _companyAnalysis;
    if (map == null) return;
    final result = await showDialog<String?>(
      context: context,
      builder:
          (ctx) => EditTextFieldDialog(
            title: title,
            initialText: _stringValue(map[key]),
          ),
    );
    if (result == null || !mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        map[key] = result;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _updateAnalysisScrollFabVisibility();
      });
    });
  }

  void _handleSystemBack() {
    if (_isSavingNickname || _isAnalyzingCompany || _isCompleting) {
      return;
    }
    if (_currentStep == _SetupStep.detail) {
      setState(() {
        _errorMessage = null;
        _currentStep = _SetupStep.analysis;
      });
      return;
    }
    if (_currentStep == _SetupStep.analysis) {
      setState(() {
        _errorMessage = null;
        _currentStep = _SetupStep.profile;
      });
      return;
    }
    if (_currentStep == _SetupStep.profile) {
      setState(() {
        _errorMessage = null;
        _currentStep = _SetupStep.nickname;
      });
      return;
    }
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).maybePop();
      return;
    }
    // 온보딩 첫 화면: 스택이 없으면 로그아웃 후 로그인 화면으로 복귀
    _auth.logout();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) return;
        _handleSystemBack();
      },
      child: Stack(
        children: [
          Scaffold(
            backgroundColor: const Color(0xFFFFF8E8),
        floatingActionButton:
            _currentStep == _SetupStep.analysis && _showAnalysisScrollFab
                ? IconButton(
                  onPressed: _scrollAnalysisToBottom,
                  tooltip: '맨 아래로',
                  padding: const EdgeInsets.all(10),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    foregroundColor: const Color(0xFF2F3542),
                    shadowColor: Colors.transparent,
                    elevation: 0,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  icon: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 20,
                  ),
                )
                : null,
        floatingActionButtonLocation:
            _currentStep == _SetupStep.analysis
                ? FloatingActionButtonLocation.centerFloat
                : FloatingActionButtonLocation.endFloat,
        body: SafeArea(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 400),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            transitionBuilder: (Widget child, Animation<double> animation) {
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.0, 0.05),
                    end: Offset.zero,
                  ).animate(animation),
                  child: child,
                ),
              );
            },
            layoutBuilder: (Widget? currentChild, List<Widget> previousChildren) {
              return Stack(
                alignment: Alignment.topCenter,
                children: <Widget>[
                  ...previousChildren,
                  if (currentChild != null) currentChild,
                ],
              );
            },
            child: _buildCurrentStep(),
          ),
        ),
      ),
      if (_isAnalyzingCompany)
        Positioned.fill(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 8.0, sigmaY: 8.0),
            child: Container(
              color: Colors.black.withValues(alpha: 0.25),
              child: Center(
                child: Material(
                  type: MaterialType.transparency,
                  child: Container(
                    width: 290,
                    padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 40,
                          offset: const Offset(0, 15),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 160,
                          height: 160,
                          child: Lottie.asset(
                            'assets/lottie/analyzing_owl.json',
                            fit: BoxFit.contain,
                          ),
                        ),
                        const SizedBox(height: 28),
                        const Text(
                          '잠시만 기다려주세요!',
                          style: TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                            color: Color(0xFF2F3542),
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          '부엉이 AI가 지원 회사와 직무를\n꼼꼼히 분석하고 있어요 🦉✨',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 15,
                            height: 1.5,
                            letterSpacing: -0.3,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF57606F),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        ],
      ),
    );
  }

  Widget _buildCurrentStep() {
    switch (_currentStep) {
      case _SetupStep.nickname:
        return _buildNicknameStep();
      case _SetupStep.profile:
        return _buildProfileStep();
      case _SetupStep.analysis:
        return _buildAnalysisStep();
      case _SetupStep.detail:
        return _buildDetailStep();
    }
  }

  Widget _buildNicknameStep() {
    final user = _auth.currentUser;
    return _SetupScaffold(
      key: const ValueKey('nickname-step'),
      currentStep: 1,
      totalSteps: 4,
      title: '먼저 닉네임을 정해주세요',
      actions: [
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: _isSavingNickname ? null : _saveNicknameAndContinue,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF2F3542),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
            ),
            child:
                _isSavingNickname
                    ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                    : const Text(
                      '다음',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
          ),
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                top: -35,
                right: 24,
                child: Image.asset(
                  'assets/images/owl_intro.png',
                  height: 115,
                  fit: BoxFit.contain,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 45),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '닉네임',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF111827),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _nicknameController,
                        textInputAction: TextInputAction.done,
                        decoration: InputDecoration(
                          hintText: '예: 모아러버, 면접장인',
                          prefixIcon: const Icon(Icons.badge_outlined),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        onChanged: (_) {
                          if (_errorMessage != null) {
                            setState(() {
                              _errorMessage = null;
                            });
                          }
                        },
                      ),
                      if ((user?.email ?? '').isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          user!.email!,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            _ErrorMessage(message: _errorMessage!),
          ],
        ],
      ),
    );
  }

  Widget _buildProfileStep() {
    return _SetupScaffold(
      key: const ValueKey('profile-step'),
      currentStep: 2,
      totalSteps: 4,
      title: '면접 볼 곳의 회사명과\n지원 직무를 적어 주세요',
      subtitle: '정확히 입력할수록 분석이 더 잘 맞습니다.',
      actions: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed:
                    _isAnalyzingCompany
                        ? null
                        : () {
                          setState(() {
                            _errorMessage = null;
                            _currentStep = _SetupStep.nickname;
                          });
                        },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Color(0xFFD1D5DB)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
                child: const Text(
                  '이전',
                  style: TextStyle(
                    color: Color(0xFF374151),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed:
                    _isAnalyzingCompany ? null : _analyzeCompanyAndContinue,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFFFC83D),
                  foregroundColor: const Color(0xFF2B2B2B),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
                child:
                    _isAnalyzingCompany
                        ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Color(0xFF2B2B2B),
                          ),
                        )
                        : const Text(
                          '분석하기',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
              ),
            ),
          ],
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                top: -60,
                right: 5,
                child: Image.asset(
                  'assets/images/owl_intro.png',
                  height: 115,
                  fit: BoxFit.contain,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 15),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _LabeledField(
                        label: '회사명',
                        hintText: '예: 네이버, 카카오, 삼성전자',
                        controller: _companyNameController,
                      ),
                      const SizedBox(height: 18),
                      _LabeledField(
                        label: '지원 직무',
                        hintText: '예: 사무직, 영업직, 마케팅, 인사',
                        controller: _jobTitleController,
                      ),
                      const SizedBox(height: 18),
                      _LabeledField(
                        label: '핵심 스킬 및 역량',
                        hintText: '예: Excel, PowerPoint, node.js, 영어 회화',
                        controller: _skillsController,
                        helperText: '쉼표(,)로 구분해서 입력해주세요.',
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        '경력 수준',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF111827),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: _buildCareerLevelButton('junior', '신입/주니어'),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _buildCareerLevelButton('mid', '미드레벨'),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _buildCareerLevelButton('senior', '시니어'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            _ErrorMessage(message: _errorMessage!),
          ],
        ],
      ),
    );
  }

  Widget _buildAnalysisStep() {
    final analysis = _companyAnalysis ?? <String, dynamic>{};
    return _SetupScaffold(
      key: const ValueKey('analysis-step'),
      currentStep: 3,
      totalSteps: 4,
      title: '면접 준비에 쓸\n회사 분석 결과예요',
      scrollController: _analysisScrollController,
      actions: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed:
                    _isCompleting
                        ? null
                        : () {
                          setState(() {
                            _errorMessage = null;
                            _currentStep = _SetupStep.profile;
                          });
                        },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Color(0xFFD1D5DB)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
                child: const Text(
                  '이전',
                  style: TextStyle(
                    color: Color(0xFF374151),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed:
                    _isCompleting
                        ? null
                        : () {
                          setState(() {
                            _errorMessage = null;
                            _currentStep = _SetupStep.detail;
                          });
                        },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2F3542),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
                child: const Text(
                  '다음',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                top: -60,
                right: 5,
                child: Image.asset(
                  'assets/images/owl_intro.png',
                  height: 115,
                  fit: BoxFit.contain,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 15),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFFF8E1), Color(0xFFFFECB3)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: const Color(0xFFFFE082)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.analytics_outlined, color: Color(0xFF5D4037)),
                              const SizedBox(width: 8),
                              const Expanded(
                                child: Text(
                                  '분석 요약',
                                  style: TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF5D4037),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _SummaryChip(
                                icon: Icons.business_outlined,
                                label: _companyNameController.text.trim(),
                              ),
                              _SummaryChip(
                                icon: Icons.work_outline_rounded,
                                label: _jobTitleController.text.trim(),
                              ),
                              _SummaryChip(
                                icon: Icons.timeline_outlined,
                                label: _careerLevelLabel(_careerLevel),
                              ),
                              if (_skillsController.text.trim().isNotEmpty)
                                _SummaryChip(
                                  icon: Icons.code_rounded,
                                  label: _skillsController.text.trim(),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    AnalysisListCard(
                      title: '핵심 가치',
                      items: _stringList(analysis['coreValues']),
                      icon: Icons.flag_outlined,
                      backgroundColor: const Color(0xFFFFF3E0),
                      textColor: const Color(0xFF8A4B08),
                      onEdit:
                          () => _showEditListField(
                            'coreValues',
                            '핵심 가치',
                            const Color(0xFFFFF3E0),
                            const Color(0xFF8A4B08),
                          ),
                    ),
                    const SizedBox(height: 12),
                    AnalysisTextCard(
                      title: '인재상',
                      content: _stringValue(analysis['idealCandidate']),
                      onEdit: () => _showEditTextField('idealCandidate', '인재상'),
                    ),
                    const SizedBox(height: 12),
                    AnalysisTextCard(
                      title: '비전/미션',
                      content: _stringValue(analysis['vision']),
                      onEdit: () => _showEditTextField('vision', '비전/미션'),
                    ),
                    const SizedBox(height: 12),
                    AnalysisTextCard(
                      title: '회사 문화',
                      content: _stringValue(analysis['companyCulture']),
                      onEdit: () => _showEditTextField('companyCulture', '회사 문화'),
                    ),
                    const SizedBox(height: 12),
                    AnalysisListCard(
                      title: '주요 사업분야',
                      items: _stringList(analysis['businessAreas']),
                      icon: Icons.apartment_rounded,
                      backgroundColor: const Color(0xFFE8F5E9),
                      textColor: const Color(0xFF1B5E20),
                      onEdit:
                          () => _showEditListField(
                            'businessAreas',
                            '주요 사업분야',
                            const Color(0xFFE8F5E9),
                            const Color(0xFF1B5E20),
                          ),
                    ),
                    const SizedBox(height: 12),
                    AnalysisListCard(
                      title: '중요 역량',
                      items: _stringList(analysis['keyCompetencies']),
                      icon: Icons.stars_outlined,
                      backgroundColor: const Color(0xFFEFEBE9),
                      textColor: const Color(0xFF4E342E),
                      onEdit:
                          () => _showEditListField(
                            'keyCompetencies',
                            '중요 역량',
                            const Color(0xFFEFEBE9),
                            const Color(0xFF4E342E),
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            _ErrorMessage(message: _errorMessage!),
          ],
        ],
      ),
    );
  }

  void _showJobDescriptionHelpDialog() {
    showDialog<void>(
      context: context,
      builder: (ctx) {
        final maxH = MediaQuery.sizeOf(ctx).height * 0.62;
        return AlertDialog(
          title: const Text(
            '직무 설명, 이렇게 적으면 좋아요',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: Color(0xFF111827),
            ),
          ),
          content: SizedBox(
            width: double.maxFinite,
            height: maxH,
            child: SingleChildScrollView(
              child: SelectableText(
                _kJobDescriptionHelpBody,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.55,
                  color: Color(0xFF374151),
                ),
              ),
            ),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF2F3542),
              ),
              child: const Text('확인'),
            ),
          ],
        );
      },
    );
  }

  void _showExperienceHelpDialog() {
    showDialog<void>(
      context: context,
      builder: (ctx) {
        final maxH = MediaQuery.sizeOf(ctx).height * 0.62;
        return AlertDialog(
          title: const Text(
            '주요 경험·프로젝트, 이렇게 적으면 좋아요',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: Color(0xFF111827),
            ),
          ),
          content: SizedBox(
            width: double.maxFinite,
            height: maxH,
            child: SingleChildScrollView(
              child: SelectableText(
                _kExperienceHelpBody,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.55,
                  color: Color(0xFF374151),
                ),
              ),
            ),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF2F3542),
              ),
              child: const Text('확인'),
            ),
          ],
        );
      },
    );
  }

  Widget _buildDetailStep() {
    return _SetupScaffold(
      key: const ValueKey('detail-step'),
      currentStep: 4,
      totalSteps: 4,
      title: '직무와 경험을\n조금 더 알려주세요',
      subtitle: '직무 설명은 선택, 주요 경험은 필수예요.',
      actions: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed:
                    _isCompleting
                        ? null
                        : () {
                          setState(() {
                            _errorMessage = null;
                            _currentStep = _SetupStep.analysis;
                          });
                        },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Color(0xFFD1D5DB)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
                child: const Text(
                  '이전',
                  style: TextStyle(
                    color: Color(0xFF374151),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: _isCompleting ? null : _completeSetup,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2F3542),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
                child:
                    _isCompleting
                        ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                        : const Text(
                          '면접 시작하기',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
              ),
            ),
          ],
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                top: -60,
                right: 5,
                child: Image.asset(
                  'assets/images/owl_intro.png',
                  height: 115,
                  fit: BoxFit.contain,
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 15),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _LabeledField(
                        label: '직무 설명 (선택사항)',
                        hintText:
                            '채용공고의 주요 업무나 자격요건을 입력하면 더 정확한 질문을 생성할 수 있습니다.',
                        controller: _jobDescriptionController,
                        maxLines: 4,
                        onHelpTap: _showJobDescriptionHelpDialog,
                      ),
                      const SizedBox(height: 20),
                      _LabeledField(
                        label: '주요 경험 및 프로젝트 (필수)',
                        hintText: '관련 경험, 프로젝트, 성과 등을 입력해주세요.',
                        controller: _experienceDetailController,
                        maxLines: 5,
                        onHelpTap: _showExperienceHelpDialog,
                        onChanged: (_) {
                          if (_errorMessage != null &&
                              _experienceDetailController.text.trim().isNotEmpty) {
                            setState(() => _errorMessage = null);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: 16),
            _ErrorMessage(message: _errorMessage!),
          ],
        ],
      ),
    );
  }
}


class _SetupScaffold extends StatelessWidget {
  const _SetupScaffold({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    required this.title,
    this.subtitle,
    this.scrollController,
    required this.child,
    required this.actions,
  });

  final int currentStep;
  final int totalSteps;
  final String title;
  final String? subtitle;
  final ScrollController? scrollController;
  final Widget child;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'STEP $currentStep / $totalSteps',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
              color: Color(0xFF8A5B00),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            title,
            textAlign: TextAlign.start,
            locale: const Locale('ko', 'KR'),
            softWrap: true,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Color(0xFF111827),
              height: 1.3,
            ),
          ),
          if (subtitle != null && subtitle!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 15,
                color: Color(0xFF6B7280),
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: 24),
          child,
          const SizedBox(height: 24),
          ...actions,
        ],
      ),
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({
    required this.label,
    required this.hintText,
    required this.controller,
    this.helperText,
    this.maxLines = 1,
    this.onChanged,
    this.onHelpTap,
  });

  final String label;
  final String hintText;
  final TextEditingController controller;
  final String? helperText;
  final int maxLines;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onHelpTap;

  @override
  Widget build(BuildContext context) {
    final isMultiline = maxLines > 1;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF111827),
                ),
              ),
            ),
            if (onHelpTap != null) ...[
              const SizedBox(width: 4),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onHelpTap,
                  borderRadius: BorderRadius.circular(20),
                  child: const Padding(
                    padding: EdgeInsets.all(4),
                    child: Icon(
                      Icons.help_outline_rounded,
                      size: 22,
                      color: Color(0xFF5D4037),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: maxLines,
          minLines: isMultiline ? 3 : 1,
          keyboardType:
              isMultiline ? TextInputType.multiline : TextInputType.text,
          textAlignVertical:
              isMultiline ? TextAlignVertical.top : TextAlignVertical.center,
          onChanged: onChanged,
          style: const TextStyle(
            fontSize: 15,
            height: 1.45,
            color: Color(0xFF374151),
          ),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: const TextStyle(
              fontSize: 14,
              color: Color(0xFF9CA3AF),
              height: 1.45,
            ),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 14,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF5D4037), width: 1.5),
            ),
          ),
        ),
        if (helperText != null) ...[
          const SizedBox(height: 6),
          Text(
            helperText!,
            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
          ),
        ],
      ],
    );
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF5D4037)),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF5D4037),
              ),
            ),
          ),
        ],
      ),
    );
  }
}



class _ErrorMessage extends StatelessWidget {
  const _ErrorMessage({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Text(
        message,
        style: const TextStyle(
          fontSize: 13,
          color: Color(0xFFB91C1C),
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
