import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'dart:ui';

import 'package:lottie/lottie.dart';
import 'package:dio/dio.dart';
import 'package:http_parser/http_parser.dart' show MediaType;
import 'dart:convert';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'dart:io';
import '../services/auth_service.dart';
import '../services/interview_prep_setup_cache.dart';
import '../services/interview_record_db.dart';
import '../utils/interview_score_display.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../config/admob_config.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../widgets/usage_limit_modal.dart';
import '../widgets/company_analysis_edit_dialogs.dart';
import '../widgets/voice_feedback_modal_tutorial_overlay.dart';
import '../widgets/native_ad_card.dart';
import '../widgets/ai_interview_loading_view.dart';
import 'login_page.dart';

/// 홈「직접 질문 쓰기」에서 넘긴 문장으로 [InterviewQuestion] 목록 구성 (API 생성과 동일 구조).
List<InterviewQuestion> buildInterviewQuestionsFromManualStrings(List<String> raw) {
  final texts = raw.map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
  return texts
      .asMap()
      .entries
      .map(
        (e) => InterviewQuestion(
          id: e.key + 1,
          category: '직접 입력',
          question: e.value,
          difficulty: 'medium',
          tips: const <String>[],
        ),
      )
      .toList();
}

class InterviewPrepPage extends StatefulWidget {
  const InterviewPrepPage({
    super.key,
    this.initialCompanyJobOnly = false,

    /// 구버전 홈 진입 API(제거 시 핫 리로드/구 호출에서 런타임 오류 가능).
    this.initialShowAdditionalFields = false,
    this.experienceProjectsOnly = false,
    this.startInterviewPractice = false,
    this.initialSetupSnapshot,
    this.initialManualQuestionTexts,
    this.onFirstCompletion,
  });

  /// true: 홈「지원 회사/직무」진입 — 회사명·직무·분석 뷰·저장만 (AI 분석 버튼·추가 필드 숨김)
  final bool initialCompanyJobOnly;

  /// 구버전 호환. [experienceProjectsOnly]와 함께 OR로 3필드 전용 모드 분기.
  final bool initialShowAdditionalFields;

  /// true: 홈「주요경험 및 프로젝트」진입 — 상세 직무·경험·역량 3필드만
  final bool experienceProjectsOnly;
  final bool startInterviewPractice;

  /// [HomePage] 등에서 미리 로드한 캐시. 있으면 첫 프레임부터 입력값이 채워집니다.
  final InterviewPrepSetupSnapshot? initialSetupSnapshot;

  /// 비어 있지 않으면 AI 질문 생성을 건너뛰고 곧바로 면접 연습 단계로 진입 (`startInterviewPractice`보다 우선).
  final List<String>? initialManualQuestionTexts;

  /// 첫 면접 완료 후 홈으로 돌아갈 때 한 번만 호출되는 콜백 (홈 탭 튜토리얼 트리거용).
  final VoidCallback? onFirstCompletion;

  @override
  State<InterviewPrepPage> createState() => _InterviewPrepPageState();
}

class _ScoreTileColors {
  final Color background;
  final Color border;
  final Color accent;
  final Color text;

  const _ScoreTileColors({
    required this.background,
    required this.border,
    required this.accent,
    required this.text,
  });
}

enum _InterviewStep { input, questions, practice, feedback }

enum _VoiceModalView { voice, text }

/// 음성 평가 모달 튜토리얼: 단계 0~12 (총 13단계, 답변 분석 강점·개선·추천·예시 포함)
const int _kVoiceModalTutorialLastStepIndex = 12;

class InterviewQuestion {
  final int id;
  final String category;
  final String question;
  final String difficulty;
  final List<String> tips;
  String? answer;
  String? feedback;
  int? score;
  Map<String, dynamic>? evaluation;

  /// 질문별 음성 평가(`/evaluate-voice` 응답의 `evaluation`). 전체 요약·카테고리 평균용.
  Map<String, dynamic>? voiceEvaluation;

  InterviewQuestion({
    required this.id,
    required this.category,
    required this.question,
    required this.difficulty,
    required this.tips,
    this.answer,
    this.feedback,
    this.score,
    this.evaluation,
    this.voiceEvaluation,
  });

  factory InterviewQuestion.fromJson(Map<String, dynamic> json) {
    return InterviewQuestion(
      id: json['id'] ?? 0,
      category: json['category'] ?? '',
      question: json['question'] ?? '',
      difficulty: json['difficulty'] ?? 'medium',
      tips: (json['tips'] as List?)?.map((e) => e.toString()).toList() ?? [],
      answer: json['answer'],
      feedback: json['feedback'],
      score: json['score'],
      evaluation: json['evaluation'] as Map<String, dynamic>?,
      voiceEvaluation: json['voiceEvaluation'] as Map<String, dynamic>?,
    );
  }
}

double? _answerScoreFromQuestion(InterviewQuestion q) {
  final v = q.evaluation?['totalScore'];
  if (v == null) return null;
  return (v is num) ? v.toDouble() : double.tryParse(v.toString());
}

double? _voiceScoreFromQuestion(InterviewQuestion q) {
  final v = q.voiceEvaluation?['overallScore'];
  if (v == null) return null;
  return (v is num) ? v.toDouble() : double.tryParse(v.toString());
}

/// 세션·카테고리 공통: 답변 평균과 음성 평균이 모두 있으면 (a+b)/2, 하나만 있으면 그 값.
double? _combinedAnswerVoiceAverage(double? answerAvg, double? voiceAvg) {
  if (answerAvg != null && voiceAvg != null) return (answerAvg + voiceAvg) / 2;
  if (answerAvg != null) return answerAvg;
  if (voiceAvg != null) return voiceAvg;
  return null;
}

double? _meanAnswerScore(List<InterviewQuestion> questions) {
  final scores =
      questions.map(_answerScoreFromQuestion).whereType<double>().toList();
  if (scores.isEmpty) return null;
  return scores.reduce((a, b) => a + b) / scores.length;
}

double? _meanVoiceScore(List<InterviewQuestion> questions) {
  final scores =
      questions.map(_voiceScoreFromQuestion).whereType<double>().toList();
  if (scores.isEmpty) return null;
  return scores.reduce((a, b) => a + b) / scores.length;
}

class _InterviewPrepPageState extends State<InterviewPrepPage> {
  final AuthService _auth = AuthService.instance;
  final AudioRecorder _recorder = AudioRecorder();

  _InterviewStep _currentStep = _InterviewStep.input;
  bool _isLoading = false;
  String? _errorMessage;

  /// 면접 질문 생성 중 리워드 광고 표시 여부(전면)
  bool _rewardedAdVisible = false;

  /// API는 끝났으나 리워드가 아직 떠 있어, 닫힌 뒤 연습 화면으로 갈지 여부
  bool _deferPracticeUntilRewardedDismiss = false;

  /// 리워드 `show()` 호출 여부(API보다 광고 쪽이 먼저 진행된 경우)
  bool _rewardedAdShowIssued = false;

  /// 리워드가 닫혔을 때 아직 질문 API 응답 전이면 true (이후 응답 시 바로 연습으로 이동)
  bool _rewardedAdDismissedBeforeApi = false;

  // 회사 분석
  bool _isAnalyzingCompany = false;
  Map<String, dynamic>? _companyAnalysis;

  // 입력 정보
  final TextEditingController _companyNameController = TextEditingController();
  final TextEditingController _jobTitleController = TextEditingController();
  final TextEditingController _jobDescriptionController =
      TextEditingController();
  final TextEditingController _experienceController = TextEditingController();
  final TextEditingController _skillsController = TextEditingController();
  final TextEditingController _transcribedTextController =
      TextEditingController();
  final ScrollController _textAnalysisScrollController = ScrollController();
  final ScrollController _voiceEvaluationScrollController = ScrollController();

  String _careerLevel = 'junior';
  bool _manualInputMode = false;
  bool _hideDirectInputButton = true;
  bool _isAnalysisExpanded = false;
  bool _isSavingProfile = false;

  // 면접 질문
  List<InterviewQuestion> _questions = [];
  int _currentQuestionIndex = 0;

  // 타이머
  bool _isTimerRunning = false;
  int _answerTime = 0;
  Timer? _timerRef;

  // 음성 녹음
  bool _isRecording = false;
  String? _recordedAudioPath;
  double _audioLevel = 0.0;
  double _smoothAudioLevel = 0.0;
  Timer? _levelTimer;

  // 음성 평가
  bool _isEvaluatingVoice = false;
  Map<String, dynamic>? _voiceEvaluation;
  String? _transcribedText;
  StateSetter? _voiceModalSetState;
  _VoiceModalView _activeVoiceModalView = _VoiceModalView.text;

  // 텍스트 분석
  bool _isEvaluatingAnswer = false;
  int? _lastEvaluatedQuestionId;
  final Set<int> _recordingAttemptedQuestionIds = <int>{};
  Map<String, dynamic>? _answerEvaluation;
  String? _answerEvaluationError;

  /// false: 캐시 로드 전(스켈레톤). true: 폼 표시 가능.
  bool _setupCacheReady = false;

  /// 피드백 단계 진입 시 로컬 SQL 기록 1회 저장
  bool _sessionRecordSaved = false;

  bool _hasSeenFeedbackTutorial = false;

  /// 완료 화면 홈 버튼 튜토리얼 (null = 비활성)
  bool _showFeedbackHomeTutorial = false;
  final GlobalKey _feedbackStackKey = GlobalKey();
  final GlobalKey _feedbackHomeButtonKey = GlobalKey();

  /// 음성 평가 모달 단계별 튜토리얼 (null = 비활성). SharedPreferences `has_seen_voice_feedback_modal_tutorial`
  int? _voiceModalTutorialStep;
  bool _pendingVoiceModalTutorial = false;

  final GlobalKey _voiceModalStackKey = GlobalKey();
  final GlobalKey _voiceModalTabsKey = GlobalKey();
  final GlobalKey _voiceModalTranscriptKey = GlobalKey();
  /// 답변 분석: 제목·재분석 버튼 줄 (튜토리얼 2/9)
  final GlobalKey _voiceModalAnswerAnalysisHeaderKey = GlobalKey();
  /// 구 필드명과 동일 심볼(구 코드·핫 리로드 `Lookup failed` 방지). 헤더 키와 같은 인스턴스.
  GlobalKey get _voiceModalAnswerAnalysisKey => _voiceModalAnswerAnalysisHeaderKey;
  /// 답변 분석: 점수·로딩·안내가 들어가는 본문 (튜토리얼 3/9, 결과 없을 때)
  final GlobalKey _voiceModalAnswerAnalysisBodyKey = GlobalKey();
  final GlobalKey _voiceModalAiAnswerResultKey = GlobalKey();
  final GlobalKey _voiceModalAnswerStrengthsKey = GlobalKey();
  final GlobalKey _voiceModalAnswerImprovementsKey = GlobalKey();
  final GlobalKey _voiceModalAnswerRecommendationsKey = GlobalKey();
  final GlobalKey _voiceModalAnswerImprovedExampleKey = GlobalKey();
  final GlobalKey _voiceModalVoiceOverallKey = GlobalKey();
  final GlobalKey _voiceModalVoiceDetailKey = GlobalKey();
  final GlobalKey _voiceModalVoiceStrengthsKey = GlobalKey();
  final GlobalKey _voiceModalVoiceImprovementsKey = GlobalKey();
  final GlobalKey _voiceModalVoiceRecommendationsKey = GlobalKey();

  /// 홈「주요경험 및 프로젝트」3필드 전용. 구 `initialShowAdditionalFields` 진입도 동일.
  bool get _experienceProjectsOnlyMode =>
      widget.experienceProjectsOnly || widget.initialShowAdditionalFields;

  void _applySetupSnapshot(InterviewPrepSetupSnapshot snap) {
    _companyNameController.text = snap.companyName;
    _jobTitleController.text = snap.jobTitle;
    _jobDescriptionController.text = snap.jobDescription;
    _experienceController.text = snap.experience;
    _skillsController.text = snap.skills;
    _companyAnalysis = snap.companyAnalysis;
    _manualInputMode = false;
    const validCareer = {'junior', 'mid', 'senior'};
    final c = snap.experienceLevel.trim();
    if (validCareer.contains(c)) {
      _careerLevel = c;
    }
  }

  Future<void> _checkTutorialStatus() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _hasSeenFeedbackTutorial = prefs.getBool('has_seen_feedback_tutorial') ?? false;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _checkTutorialStatus();
    if (widget.initialSetupSnapshot != null) {
      _applySetupSnapshot(widget.initialSetupSnapshot!);
      _setupCacheReady = true;
    }

    final manual = widget.initialManualQuestionTexts;
    final hasManual = manual != null && manual.isNotEmpty;
    if (manual != null && manual.isNotEmpty) {
      final built = buildInterviewQuestionsFromManualStrings(manual);
      if (built.isNotEmpty) {
        _questions = built;
        _currentStep = _InterviewStep.practice;
        _isLoading = false;
      }
    } else if (widget.startInterviewPractice) {
      // 면접 시작(AI 맞춤 질문): 프로필 입력 단계를 건너뛰고 곧바로 질문 생성 로딩 화면
      _currentStep = _InterviewStep.questions;
      _isLoading = true;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (hasManual && _questions.isNotEmpty) {
        if (widget.initialSetupSnapshot == null) {
          await _loadInterviewPrepSetupCache();
        } else {
          await _auth.restoreSession();
        }
        return;
      }
      if (widget.initialSetupSnapshot == null) {
        await _loadInterviewPrepSetupCache();
        if (!mounted) return;
      } else {
        await _auth.restoreSession();
        if (!mounted) return;
      }
      if (widget.startInterviewPractice) {
        await _generateQuestions();
        return;
      }
    });
  }

  Future<void> _persistInterviewPrepSetupCache() async {
    final raw = _companyAnalysis;
    final merged =
        raw != null ? Map<String, dynamic>.from(raw) : <String, dynamic>{};
    await InterviewPrepSetupCache.save(
      _auth.currentUser?.id,
      companyName: _companyNameController.text.trim(),
      jobTitle: _jobTitleController.text.trim(),
      experienceLevel: _careerLevel,
      skills: _skillsController.text.trim(),
      jobDescription: _jobDescriptionController.text.trim(),
      experience: _experienceController.text.trim(),
      companyAnalysis: InterviewPrepSetupCache.normalizeCompanyAnalysis(merged),
    );
  }

  Future<void> _saveProfileAndPopHome() async {
    setState(() => _isSavingProfile = true);
    try {
      await _persistInterviewPrepSetupCache();
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('저장에 실패했습니다. 다시 시도해주세요.')));
      }
    } finally {
      if (mounted) {
        setState(() => _isSavingProfile = false);
      }
    }
  }

  Future<void> _loadInterviewPrepSetupCache() async {
    await _auth.restoreSession();
    final snap = await InterviewPrepSetupCache.load(_auth.currentUser?.id);
    if (!mounted) return;
    setState(() {
      if (snap != null) {
        _applySetupSnapshot(snap);
      }
      _setupCacheReady = true;
    });
  }

  @override
  void dispose() {
    _timerRef?.cancel();
    _levelTimer?.cancel();
    _recorder.dispose();
    _companyNameController.dispose();
    _jobTitleController.dispose();
    _jobDescriptionController.dispose();
    _experienceController.dispose();
    _skillsController.dispose();
    _transcribedTextController.dispose();
    _textAnalysisScrollController.dispose();
    _voiceEvaluationScrollController.dispose();
    super.dispose();
  }

  Future<Dio> _createAuthorizedDio() async {
    await _auth.restoreSession();
    final token = _auth.token;
    final base = _auth.client.options.baseUrl.trim();
    final baseUrl =
        base.isEmpty
            ? 'https://www.moa.tools'
            : base.replaceFirst(RegExp(r'/$'), '');
    return Dio(
      BaseOptions(
        baseUrl: baseUrl,
        headers: {
          if (token != null && token.isNotEmpty)
            'Authorization': 'Bearer $token',
        },
        connectTimeout: const Duration(seconds: 60),
        sendTimeout: const Duration(seconds: 300),
        receiveTimeout: const Duration(seconds: 300),
      ),
    );
  }

  Future<void> _analyzeCompany() async {
    if (_companyNameController.text.trim().isEmpty) {
      setState(() {
        _errorMessage = '회사명을 입력해주세요.';
      });
      return;
    }

    setState(() {
      _isAnalyzingCompany = true;
      _errorMessage = null;
    });

    try {
      final dio = await _createAuthorizedDio();

      final response = await dio.post(
        '/api/interview-prep/analyze-company',
        data: {
          'companyName': _companyNameController.text.trim(),
          'jobTitle': _jobTitleController.text.trim(),
        },
        options: Options(
          headers: {'X-Requested-With': 'moa_interview_flutter'},
        ),
      );

      if (response.statusCode == 200 && response.data['success'] == true) {
        setState(() {
          _companyAnalysis = response.data['companyAnalysis'];
          _manualInputMode = false;
        });
      } else {
        throw Exception('회사 분석에 실패했습니다.');
      }
    } catch (e) {
      print('회사 분석 오류: $e');
      setState(() {
        _errorMessage = '회사 분석 중 오류가 발생했습니다: ${e.toString()}';
      });
    } finally {
      setState(() {
        _isAnalyzingCompany = false;
      });
    }
  }

  void _showReportModal() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        final reasons = [
          '부적절한 콘텐츠',
          '폭력적이거나 혐오스러운 내용',
          '성적인 콘텐츠',
          '저작권 침해',
          '기타',
        ];
        String? selectedReason;
        final controller = TextEditingController();
        return StatefulBuilder(
          builder: (context, setModalState) {
            final viewInsets = MediaQuery.of(context).viewInsets;
            final bottomPadding =
                viewInsets.bottom > 0
                    ? viewInsets.bottom
                    : MediaQuery.of(context).padding.bottom;
            return Padding(
              padding: EdgeInsets.only(bottom: bottomPadding + 20),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                'AI 생성 콘텐츠 신고',
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close),
                              onPressed: () => Navigator.of(context).maybePop(),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          '신고 사유를 선택해주세요',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: Colors.grey[700]),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children:
                              reasons.map((reason) {
                                final isSelected = selectedReason == reason;
                                return ChoiceChip(
                                  label: Text(reason),
                                  selected: isSelected,
                                  onSelected: (_) {
                                    setModalState(() {
                                      selectedReason =
                                          isSelected ? null : reason;
                                    });
                                  },
                                  selectedColor: Colors.red[50],
                                  labelStyle: Theme.of(
                                    context,
                                  ).textTheme.bodyMedium?.copyWith(
                                    color:
                                        isSelected
                                            ? Colors.red[700]
                                            : Colors.black87,
                                    fontWeight: FontWeight.w600,
                                  ),
                                );
                              }).toList(),
                        ),
                        const SizedBox(height: 16),
                        TextField(
                          controller: controller,
                          maxLines: 3,
                          decoration: const InputDecoration(
                            hintText: '추가 설명 (선택사항)',
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          '신고된 콘텐츠는 검토 후 조치됩니다. 문의사항은 내 정보 > 문의하기를 이용해주세요.',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: Colors.grey[700]),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red,
                              foregroundColor: Colors.white,
                            ),
                            onPressed: () {
                              Navigator.of(context).maybePop();
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('신고가 접수되었습니다. 검토 후 조치하겠습니다.'),
                                ),
                              );
                            },
                            child: const Text('신고하기'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _attachQuestionGenRewardedAd(Completer<void> apiDoneCompleter) {
    if (!AdmobConfig.supportedPlatform) {
      return;
    }

    RewardedAd.load(
      adUnitId: AdmobConfig.rewardedUnitId,
      request: const AdRequest(),
      rewardedAdLoadCallback: RewardedAdLoadCallback(
        onAdLoaded: (RewardedAd ad) {
          if (!mounted) {
            ad.dispose();
            return;
          }
          if (apiDoneCompleter.isCompleted) {
            ad.dispose();
            return;
          }
          _rewardedAdShowIssued = true;
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdShowedFullScreenContent: (Ad ad) {
              if (!mounted) return;
              setState(() => _rewardedAdVisible = true);
            },
            onAdDismissedFullScreenContent: (Ad ad) {
              ad.dispose();
              if (!mounted) return;
              setState(() {
                _rewardedAdVisible = false;
                if (_deferPracticeUntilRewardedDismiss && _questions.isNotEmpty) {
                  _currentStep = _InterviewStep.practice;
                  _isLoading = false;
                  _deferPracticeUntilRewardedDismiss = false;
                } else if (!_deferPracticeUntilRewardedDismiss &&
                    _questions.isEmpty) {
                  _rewardedAdDismissedBeforeApi = true;
                }
              });
            },
            onAdFailedToShowFullScreenContent: (Ad ad, Object error) {
              ad.dispose();
              if (!mounted) return;
              setState(() {
                _rewardedAdVisible = false;
                // iPad 등에서 전면 광고 표시가 실패해도 질문 로드가 끝났으면 연습 단계로 복구
                if (_deferPracticeUntilRewardedDismiss &&
                    _questions.isNotEmpty) {
                  _currentStep = _InterviewStep.practice;
                  _isLoading = false;
                  _deferPracticeUntilRewardedDismiss = false;
                }
              });
            },
          );
          ad.show(
            onUserEarnedReward: (AdWithoutView ad, RewardItem reward) {},
          );
        },
        onAdFailedToLoad: (LoadAdError error) {
          debugPrint('면접 질문 생성 리워드 광고 로드 실패: $error');
        },
      ),
    );
  }

  Future<void> _generateQuestions() async {
    if (_manualInputMode) {
      if (_companyNameController.text.trim().isEmpty ||
          _jobTitleController.text.trim().isEmpty) {
        setState(() {
          _errorMessage = '회사명과 직무를 모두 입력해주세요.';
          _currentStep = _InterviewStep.input;
          _isLoading = false;
        });
        return;
      }
    } else {
      if (_companyAnalysis == null) {
        setState(() {
          _errorMessage = '먼저 회사 분석을 진행해주세요.';
          _currentStep = _InterviewStep.input;
          _isLoading = false;
        });
        return;
      }
    }

    await _auth.restoreSession();
    if (!_auth.isLoggedIn) {
      if (!mounted) return;
      setState(() {
        _currentStep = _InterviewStep.input;
        _isLoading = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('로그인 후 이용해 주세요.')));
      return;
    }

    final apiDoneCompleter = Completer<void>();

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _currentStep = _InterviewStep.questions;
      _rewardedAdVisible = false;
      _deferPracticeUntilRewardedDismiss = false;
      _rewardedAdShowIssued = false;
      _rewardedAdDismissedBeforeApi = false;
    });

    final dio = await _createAuthorizedDio();
    final Future<Response<dynamic>> apiFuture = dio.post(
      '/api/interview-prep/generate-questions',
      data: {
        'companyName': _companyNameController.text.trim(),
        'jobTitle': _jobTitleController.text.trim(),
        'jobDescription': _jobDescriptionController.text.trim(),
        'experience': _experienceController.text.trim(),
        'skills': _skillsController.text.trim(),
        'careerLevel': _careerLevel,
        'companyAnalysis': _companyAnalysis,
        'manualInputMode': _manualInputMode,
      },
      options: Options(
        headers: {'X-Requested-With': 'moa_interview_flutter'},
      ),
    );

    _attachQuestionGenRewardedAd(apiDoneCompleter);

    try {
      // 서버/네트워크 무한 대기 방지. Vercel maxDuration(300s) + Dio receiveTimeout과 맞춤.
      const Duration generateQuestionsTimeout = Duration(seconds: 300);
      final response = await apiFuture.timeout(
        generateQuestionsTimeout,
        onTimeout: () {
          throw TimeoutException(
            '면접 질문 생성 요청 시간 초과',
            generateQuestionsTimeout,
          );
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        final questionsList =
            (data['questions'] as List)
                .map((q) => InterviewQuestion.fromJson(q))
                .toList();

        if (!mounted) return;

        if (_rewardedAdShowIssued) {
          if (_rewardedAdDismissedBeforeApi) {
            setState(() {
              _questions = questionsList;
              _currentStep = _InterviewStep.practice;
              _isLoading = false;
              _deferPracticeUntilRewardedDismiss = false;
            });
          } else {
            // 리워드가 뜬 뒤 API가 끝난 경우: 전면이 닫힐 때까지 로딩 단계 유지
            setState(() {
              _questions = questionsList;
              _deferPracticeUntilRewardedDismiss = true;
              _isLoading = true;
            });
          }
        } else {
          setState(() {
            _questions = questionsList;
            _currentStep = _InterviewStep.practice;
            _isLoading = false;
          });
        }
      } else {
        throw Exception('면접 질문 생성에 실패했습니다.');
      }
    } on TimeoutException catch (_) {
      if (mounted) {
        setState(() {
          _errorMessage =
              '응답이 지연되고 있습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.';
          _currentStep = _InterviewStep.input;
          _isLoading = false;
          _deferPracticeUntilRewardedDismiss = false;
          _rewardedAdDismissedBeforeApi = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('질문 생성 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.'),
          ),
        );
      }
    } on DioException catch (error) {
      if (error.response?.statusCode == 429) {
        final data = error.response?.data as Map<String, dynamic>?;
        final currentUsage = data?['currentUsage'] as int? ?? 0;
        final maxLimit = data?['maxLimit'] as int? ?? 0;
        final resetDateStr = data?['resetDate'] as String?;
        final resetDate =
            resetDateStr != null ? DateTime.tryParse(resetDateStr) : null;

        if (mounted) {
          setState(() {
            _isLoading = false;
            _currentStep = _InterviewStep.input;
            _deferPracticeUntilRewardedDismiss = false;
            _rewardedAdDismissedBeforeApi = false;
          });
          await showDialog(
            context: context,
            barrierDismissible: true,
            builder:
                (_) => UsageLimitModal(
                  onClose: () => Navigator.of(context).pop(),
                  currentUsage: currentUsage,
                  maxLimit: maxLimit,
                  serviceType: 'productivity',
                  resetDate: resetDate,
                ),
          );
        }
        return;
      }
      print('면접 질문 생성 오류: $error');
      if (mounted) {
        setState(() {
          _errorMessage = '면접 질문 생성 중 오류가 발생했습니다: ${error.toString()}';
          _currentStep = _InterviewStep.input;
          _isLoading = false;
          _deferPracticeUntilRewardedDismiss = false;
          _rewardedAdDismissedBeforeApi = false;
        });
      }
    } catch (e) {
      print('면접 질문 생성 오류: $e');
      if (mounted) {
        setState(() {
          _errorMessage = '면접 질문 생성 중 오류가 발생했습니다: ${e.toString()}';
          _currentStep = _InterviewStep.input;
          _isLoading = false;
          _deferPracticeUntilRewardedDismiss = false;
          _rewardedAdDismissedBeforeApi = false;
        });
      }
    } finally {
      if (!apiDoneCompleter.isCompleted) {
        apiDoneCompleter.complete();
      }
    }
  }

  void _clearVoiceFeedbackState() {
    _voiceEvaluation = null;
    _transcribedText = null;
    _transcribedTextController.clear();
    _answerEvaluation = null;
    _answerEvaluationError = null;
    _isEvaluatingVoice = false;
    _isEvaluatingAnswer = false;
    _activeVoiceModalView = _VoiceModalView.text;
    _lastEvaluatedQuestionId = null;
  }

  Future<void> _startRecording() async {
    if (_questions.isEmpty || _currentQuestionIndex >= _questions.length) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('먼저 질문을 준비한 뒤 녹음을 시작해 주세요.')),
      );
      return;
    }

    try {
      final hasPermission = await _recorder.hasPermission();
      if (!hasPermission) {
        if (!mounted) return;
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('마이크 접근 권한이 필요합니다.')));
        return;
      }

      final directory = await getTemporaryDirectory();
      final filePath =
          '${directory.path}/interview_${DateTime.now().millisecondsSinceEpoch}.m4a';
      const recordConfig = RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 128000,
        sampleRate: 44100,
      );
      await _recorder.start(recordConfig, path: filePath);

      setState(() {
        _isRecording = true;
        _recordedAudioPath = null;
        _answerTime = 0;
        _isTimerRunning = true;
        _audioLevel = 0.0;
        _smoothAudioLevel = 0.0;
        _clearVoiceFeedbackState();
        _recordingAttemptedQuestionIds.add(
          _questions[_currentQuestionIndex].id,
        );
      });

      _timerRef?.cancel();
      _timerRef = Timer.periodic(const Duration(seconds: 1), (_) {
        setState(() {
          _answerTime++;
        });
      });

      _levelTimer?.cancel();
      _levelTimer = Timer.periodic(const Duration(milliseconds: 150), (
        _,
      ) async {
        if (!_isRecording) return;
        try {
          final amplitude = await _recorder.getAmplitude();
          final current =
              amplitude.current.isFinite ? amplitude.current : -120.0;
          double normalized = (current + 60) / 60;
          normalized = normalized.clamp(0.0, 1.0);
          setState(() {
            _audioLevel = normalized;
            _smoothAudioLevel = (_smoothAudioLevel * 0.7) + (normalized * 0.3);
          });
        } catch (_) {
          // ignore amplitude errors
        }
      });
    } catch (e) {
      print('녹음 시작 오류: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('녹음을 시작할 수 없습니다.')));
    }
  }

  Future<void> _stopRecording() async {
    try {
      final path = await _recorder.stop();
      _timerRef?.cancel();
      _levelTimer?.cancel();

      setState(() {
        _isRecording = false;
        _isTimerRunning = false;
        _recordedAudioPath = path;
        _audioLevel = 0.0;
        _smoothAudioLevel = 0.0;
      });

      // 녹음이 끝나면 즉시 저장/분석 시작
      if (path != null) {
        _evaluateVoice(questionIndex: _currentQuestionIndex, audioPath: path);
      }
    } catch (e) {
      print('녹음 정지 오류: $e');
      _levelTimer?.cancel();
      setState(() {
        _isRecording = false;
        _isTimerRunning = false;
        _audioLevel = 0.0;
        _smoothAudioLevel = 0.0;
      });
    }
  }

  void _startTimer() {
    setState(() {
      _isTimerRunning = true;
      _answerTime = 0;
    });
    _timerRef?.cancel();
    _timerRef = Timer.periodic(const Duration(seconds: 1), (_) {
      setState(() {
        _answerTime++;
      });
    });
  }

  void _stopTimer() {
    setState(() {
      _isTimerRunning = false;
    });
    _timerRef?.cancel();
  }

  void _resetTimer() {
    setState(() {
      _isTimerRunning = false;
      _answerTime = 0;
      _recordedAudioPath = null;
      _audioLevel = 0.0;
      _smoothAudioLevel = 0.0;
      _clearVoiceFeedbackState();
    });
    _timerRef?.cancel();
    _levelTimer?.cancel();
  }

  /// 이전 질문으로 돌아갈 때 `_questions[index]`에 저장된 음성·답변 평가를 화면 상태에 맞춤.
  void _hydratePracticeStateFromCurrentQuestion() {
    final q = _questions[_currentQuestionIndex];
    final ve = q.voiceEvaluation;
    if (ve != null) {
      _voiceEvaluation = Map<String, dynamic>.from(ve);
    } else {
      _voiceEvaluation = null;
    }
    final ae = q.evaluation;
    if (ae != null) {
      _answerEvaluation = Map<String, dynamic>.from(ae);
    } else {
      _answerEvaluation = null;
    }
    if (q.answer != null && q.answer!.trim().isNotEmpty) {
      _transcribedText = q.answer;
      _transcribedTextController.text = q.answer!;
    } else {
      _transcribedText = null;
      _transcribedTextController.clear();
    }
    _answerEvaluationError = null;
    _isEvaluatingVoice = false;
    _isEvaluatingAnswer = false;
    _lastEvaluatedQuestionId =
        (ve != null || ae != null) ? q.id : null;
    _activeVoiceModalView = _VoiceModalView.text;
  }

  Future<void> _goToPreviousQuestion() async {
    if (_currentQuestionIndex <= 0) return;
    if (_isRecording) {
      await _stopRecording();
    }
    _timerRef?.cancel();
    _levelTimer?.cancel();
    if (!mounted) return;
    setState(() {
      _currentQuestionIndex--;
      _isRecording = false;
      _isTimerRunning = false;
      _answerTime = 0;
      _recordedAudioPath = null;
      _audioLevel = 0.0;
      _smoothAudioLevel = 0.0;
      _hydratePracticeStateFromCurrentQuestion();
    });
  }

  String _formatTime(int seconds) {
    final mins = (seconds ~/ 60).toString().padLeft(2, '0');
    final secs = (seconds % 60).toString().padLeft(2, '0');
    return '$mins:$secs';
  }

  bool _canProceedToNextQuestion() {
    if (_currentQuestionIndex >= _questions.length) return false;
    final currentQuestion = _questions[_currentQuestionIndex];
    final hasAnswer =
        currentQuestion.answer != null &&
        currentQuestion.answer!.trim().isNotEmpty;
    final attemptedRecording = _recordingAttemptedQuestionIds.contains(
      currentQuestion.id,
    );

    // 녹음을 시작한 적이 없다면 건너뛸 수 있게 허용
    if (!attemptedRecording) {
      return true;
    }

    // 녹음을 시작했다면 저장이 완료되어 답변이 있어야 함
    return hasAnswer;
  }

  /// 완료(피드백) 화면에서 상단 뒤로가기 — 홈에서 push된 경우 메인(홈)으로 복귀
  Future<void> _popToMainFromFeedback() async {
    // 첫 완료 시에만 콜백 호출 (홈 탭 튜토리얼 트리거)
    final prefs = await SharedPreferences.getInstance();
    final hasSeen = prefs.getBool('has_seen_home_tabs_tutorial') ?? false;
    if (!hasSeen) {
      await prefs.setBool('has_seen_home_tabs_tutorial', true);
      widget.onFirstCompletion?.call();
    }
    if (!mounted) return;
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      _reset();
    }
  }

  void _reset() {
    setState(() {
      _sessionRecordSaved = false;
      _currentStep = _InterviewStep.input;
      _companyAnalysis = null;
      _questions = [];
      _currentQuestionIndex = 0;
      _errorMessage = null;
      _manualInputMode = false;
      _hideDirectInputButton = true;
      _companyNameController.clear();
      _jobTitleController.clear();
      _jobDescriptionController.clear();
      _experienceController.clear();
      _skillsController.clear();
      _careerLevel = 'junior';
      _recordingAttemptedQuestionIds.clear();
    });
    _resetTimer();
  }

  void _showTipsDialog() {
    if (_questions.isEmpty || _currentQuestionIndex >= _questions.length)
      return;

    final question = _questions[_currentQuestionIndex];

    showDialog(
      context: context,
      builder:
          (context) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: const Row(
              children: [
                Icon(Icons.lightbulb, color: Color(0xFFF59E0B), size: 24),
                SizedBox(width: 8),
                Text(
                  '답변 가이드',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF111827),
                  ),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children:
                    question.tips
                        .map(
                          (tip) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  '• ',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: Color(0xFFF59E0B),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Expanded(
                                  child: Text(
                                    tip,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      color: Color(0xFF4B5563),
                                      height: 1.6,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                        .toList(),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text(
                  '닫기',
                  style: TextStyle(
                    color: Color(0xFFF59E0B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
    );
  }

  void _showCompanyKeywordsModal() {
    if (_companyAnalysis == null) return;
    final analysis = _companyAnalysis!;
    final companyName =
        _companyNameController.text.trim().isEmpty
            ? '회사'
            : _companyNameController.text.trim();

    showDialog<void>(
      context: context,
      builder:
          (context) => AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: Row(
              children: [
                const Icon(
                  Icons.track_changes,
                  color: Color(0xFF5D4037),
                  size: 22,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '💡 $companyName 회사 키워드',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF5D4037),
                    ),
                  ),
                ),
              ],
            ),
            content: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      ...((analysis['coreValues'] as List<dynamic>?)
                              ?.take(3)
                              .map(
                                (value) => Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF3E0),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    value.toString(),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: Color(0xFF5D4037),
                                    ),
                                  ),
                                ),
                              ) ??
                          []),
                      ...((analysis['keyCompetencies'] as List<dynamic>?)
                              ?.take(2)
                              .map(
                                (competency) => Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFD1FAE5),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    competency.toString(),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w500,
                                      color: Color(0xFF065F46),
                                    ),
                                  ),
                                ),
                              ) ??
                          []),
                      if ((analysis['idealCandidate'] as String?)?.isNotEmpty ??
                          false)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD7CCC8),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            (analysis['idealCandidate'] as String).length > 15
                                ? '${(analysis['idealCandidate'] as String).substring(0, 15)}...'
                                : (analysis['idealCandidate'] as String),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Color(0xFF4E342E),
                            ),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    '💡 이 키워드들을 답변에 자연스럽게 포함해보세요!',
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFFFF8F00),
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text(
                  '닫기',
                  style: TextStyle(
                    color: Color(0xFFF59E0B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
    );
  }

  void _refreshVoiceModal() {
    // 모달 내부 상태 업데이트
    final modalSetState = _voiceModalSetState;
    if (modalSetState != null) {
      try {
        modalSetState(() {});
      } catch (_) {
        _voiceModalSetState = null;
      }
    }

    // 메인 화면 상태도 함께 업데이트 (버튼 활성화 상태 반영)
    if (mounted) {
      setState(() {});
    }
  }

  /// `primary: false` 스크롤뷰는 첫 프레임에 [ScrollController]가 안 붙을 수 있어
  /// [Scrollable.ensureVisible]이 무력화됨 → 컨트롤러 연결을 기다린 뒤 스크롤.
  Future<void> _waitForScrollController(ScrollController c) async {
    for (var i = 0; i < 40; i++) {
      if (!mounted) return;
      if (c.hasClients) return;
      await Future<void>.delayed(const Duration(milliseconds: 40));
    }
  }

  /// 튜토리얼 단계에 맞춰 모달 내부 스크롤을 자동으로 맞춤 (부모에서 호출).
  Future<void> _scrollVoiceModalTutorialTargetIntoView() async {
    final step = _voiceModalTutorialStep;
    if (step == null) return;
    final key = resolveVoiceModalTutorialTargetKey(
      step: step,
      hasTranscript: _transcribedTextController.text.trim().isNotEmpty,
      hasAnswerEvaluation: _answerEvaluation != null,
      tabsKey: _voiceModalTabsKey,
      transcriptKey: _voiceModalTranscriptKey,
      answerAnalysisHeaderKey: _voiceModalAnswerAnalysisHeaderKey,
      answerAnalysisBodyKey: _voiceModalAnswerAnalysisBodyKey,
      answerResultKey: _voiceModalAiAnswerResultKey,
      answerStrengthsKey: _voiceModalAnswerStrengthsKey,
      answerImprovementsKey: _voiceModalAnswerImprovementsKey,
      answerRecommendationsKey: _voiceModalAnswerRecommendationsKey,
      answerImprovedExampleKey: _voiceModalAnswerImprovedExampleKey,
      voiceOverallKey: _voiceModalVoiceOverallKey,
      voiceDetailKey: _voiceModalVoiceDetailKey,
      voiceStrengthsKey: _voiceModalVoiceStrengthsKey,
      voiceImprovementsKey: _voiceModalVoiceImprovementsKey,
      voiceRecommendationsKey: _voiceModalVoiceRecommendationsKey,
    );
    if (key == null) return;
    final alignment = scrollAlignmentForVoiceModalTutorialStep(step);
    if (step >= 1 && step <= 7) {
      await _waitForScrollController(_textAnalysisScrollController);
    } else if (step >= 8 && step <= 12) {
      await _waitForScrollController(_voiceEvaluationScrollController);
    }
    if (!mounted) return;
    for (var attempt = 0; attempt < 12; attempt++) {
      if (!mounted) return;
      final ctx = key.currentContext;
      if (ctx == null) {
        await Future<void>.delayed(const Duration(milliseconds: 45));
        continue;
      }
      if (Scrollable.maybeOf(ctx) == null) {
        return;
      }
      try {
        await Scrollable.ensureVisible(
          ctx,
          duration: Duration(milliseconds: 380 + attempt * 30),
          curve: Curves.easeInOut,
          alignment: alignment,
        );
        return;
      } catch (e, st) {
        debugPrint('Voice modal tutorial scroll: $e\n$st');
      }
      await Future<void>.delayed(const Duration(milliseconds: 45));
    }
  }

  /// 탭·단계 변경 직후 레이아웃이 반영된 다음 스크롤 (postFrame만 쓰면 타이밍이 어긋날 수 있음)
  Future<void> _afterVoiceModalTutorialStepChanged() async {
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return;
    await _scrollVoiceModalTutorialTargetIntoView();
    if (!mounted) return;
    _voiceModalSetState?.call(() {});
  }

  /// 답변 분석 4~7단계: 해당 블록이 비어 있으면 튜토리얼에서 건너뜀
  bool _shouldSkipAnswerAnalysisTutorialStep(int step) {
    if (step < 4 || step > 7) return false;
    final ev = _answerEvaluation;
    if (ev == null) return true;
    final strengths = _stringList(ev['strengths']);
    final improvements = _stringList(ev['improvements']);
    final recommendations = _stringList(ev['recommendations']);
    final improvedExample = (ev['improvedExample']?.toString() ?? '').trim();
    switch (step) {
      case 4:
        return strengths.isEmpty;
      case 5:
        return improvements.isEmpty;
      case 6:
        return recommendations.isEmpty;
      case 7:
        return improvedExample.isEmpty;
      default:
        return false;
    }
  }

  int _computeNextVoiceModalTutorialStep(int from) {
    var next = from + 1;
    while (next <= 7 && _shouldSkipAnswerAnalysisTutorialStep(next)) {
      next++;
    }
    return next;
  }

  void _changeVoiceModalView(_VoiceModalView view) {
    if (_activeVoiceModalView == view) return;
    _activeVoiceModalView = view;
    _refreshVoiceModal();
  }

  Widget _buildVoiceModalTabButton(
    _VoiceModalView view,
    String label,
    IconData icon, {
    Key? key,
  }) {
    final selected = _activeVoiceModalView == view;
    return GestureDetector(
      key: key,
      onTap: () => _changeVoiceModalView(view),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF5D4037) : const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? const Color(0xFF5D4037) : const Color(0xFFE5E7EB),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: selected ? Colors.white : const Color(0xFF6B7280),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: selected ? Colors.white : const Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _tryStartVoiceModalTutorial() {
    if (!_pendingVoiceModalTutorial) return;
    if (_isEvaluatingVoice) return;
    if (_voiceModalSetState == null) return;
    // 모달·GlobalKey가 트리에 안정적으로 붙은 뒤에 오버레이를 올려
    // (레이아웃 전에 빌드되며 발생할 수 있는 런타임 꼬임 방지)
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!_pendingVoiceModalTutorial) return;
      if (_isEvaluatingVoice) return;
      if (_voiceModalSetState == null) return;
      if (_activeVoiceModalView != _VoiceModalView.text) {
        _changeVoiceModalView(_VoiceModalView.text);
      }
      setState(() {
        _voiceModalTutorialStep = 0;
        _pendingVoiceModalTutorial = false;
      });
      _voiceModalSetState?.call(() {});
      unawaited(_afterVoiceModalTutorialStepChanged());
    });
  }

  Future<void> _advanceVoiceModalTutorial() async {
    if (_voiceModalTutorialStep == null) return;
    if (_voiceModalTutorialStep! < _kVoiceModalTutorialLastStepIndex) {
      final next = _computeNextVoiceModalTutorialStep(_voiceModalTutorialStep!);
      if (next >= 8 && _activeVoiceModalView != _VoiceModalView.voice) {
        _changeVoiceModalView(_VoiceModalView.voice);
      } else if (next <= 7 && _activeVoiceModalView != _VoiceModalView.text) {
        _changeVoiceModalView(_VoiceModalView.text);
      }
      setState(() => _voiceModalTutorialStep = next);
      _voiceModalSetState?.call(() {});
      await _afterVoiceModalTutorialStepChanged();
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_seen_voice_feedback_modal_tutorial', true);
    if (!mounted) return;
    setState(() => _voiceModalTutorialStep = null);
    _voiceModalSetState?.call(() {});
  }

  Future<void> _evaluateVoice({int? questionIndex, String? audioPath}) async {
    if (_isEvaluatingVoice) {
      print('⚠️ 이미 음성 저장/분석이 진행 중입니다.');
      return;
    }

    final recordingPath = audioPath ?? _recordedAudioPath;
    if (recordingPath == null || _questions.isEmpty) {
      print('⚠️ 저장할 녹음 파일이 없습니다.');
      return;
    }

    final targetIndex = questionIndex ?? _currentQuestionIndex;
    if (targetIndex >= _questions.length) {
      print('⚠️ 질문 인덱스가 범위를 벗어났습니다.');
      return;
    }
    final targetQuestion = _questions[targetIndex];
    final targetQuestionId = targetQuestion.id;

    if (mounted) {
      setState(() {
        _isEvaluatingVoice = true;
        _voiceEvaluation = null;
        _transcribedText = null;
        _transcribedTextController.clear();
        _answerEvaluation = null;
        _answerEvaluationError = null;
        _isEvaluatingAnswer = false;
        _activeVoiceModalView = _VoiceModalView.text;
      });
    }
    _refreshVoiceModal();

    try {
      final dio = await _createAuthorizedDio();
      final file = File(recordingPath);

      if (!await file.exists()) {
        throw Exception('녹음 파일을 찾을 수 없습니다.');
      }

      final bytes = await file.readAsBytes();
      print('📤 음성 파일 전송: ${bytes.length} bytes');

      final formData = FormData.fromMap({
        'audio': MultipartFile.fromBytes(
          bytes,
          filename: p.basename(recordingPath),
          contentType: MediaType('audio', 'm4a'),
        ),
        'question': targetQuestion.question,
        'category': targetQuestion.category,
      });

      print('📡 API 요청: /api/interview-prep/evaluate-voice');
      print('   - 질문: ${targetQuestion.question}');
      print('   - 카테고리: ${targetQuestion.category}');

      final response = await dio
          .post(
            '/api/interview-prep/evaluate-voice',
            data: formData,
            options: Options(
              contentType: 'multipart/form-data',
              headers: {'X-Requested-With': 'moa_interview_flutter'},
              sendTimeout: const Duration(seconds: 120),
              receiveTimeout: const Duration(seconds: 120),
            ),
            onSendProgress: (sent, total) {
              print('📤 업로드 진행: $sent / $total bytes');
            },
            onReceiveProgress: (received, total) {
              print('📥 응답 수신: $received / $total bytes');
            },
          )
          .timeout(
            const Duration(seconds: 120),
            onTimeout: () {
              throw Exception('음성 평가 요청 시간이 초과되었습니다. 네트워크를 확인해주세요.');
            },
          );

      print('📥 응답 상태: ${response.statusCode}');
      print('📥 응답 데이터 타입: ${response.data.runtimeType}');
      print('📥 응답 데이터: ${response.data}');

      if (response.statusCode == 200) {
        final data = response.data;
        if (data['success'] == true && data['evaluation'] != null) {
          final transcript = data['transcribedText']?.toString();
          final evalMap = data['evaluation'];
          final voiceEval =
              evalMap is Map<String, dynamic>
                  ? Map<String, dynamic>.from(evalMap)
                  : null;
          if (mounted) {
            setState(() {
              if (targetIndex < _questions.length && voiceEval != null) {
                _questions[targetIndex].voiceEvaluation = voiceEval;
              }

              // 현재 질문에 답변 저장
              if (targetIndex < _questions.length && transcript != null) {
                _questions[targetIndex].answer = transcript;
                print(
                  '✅ 답변 저장됨: ${transcript.substring(0, transcript.length > 50 ? 50 : transcript.length)}...',
                );
              }
              if (targetIndex == _currentQuestionIndex) {
                _voiceEvaluation = evalMap;
                _transcribedText = transcript;
                _transcribedTextController.text = transcript ?? '';
                _lastEvaluatedQuestionId = targetQuestionId;
              }
            });
          }
          _refreshVoiceModal();

          if (transcript != null && transcript.trim().isNotEmpty) {
            _evaluateTranscribedAnswer(transcript, questionIndex: targetIndex);
          } else if (mounted && targetIndex == _currentQuestionIndex) {
            setState(() {
              _answerEvaluationError = '음성 텍스트를 가져오지 못했습니다. 조금 더 길게 말씀해 주세요.';
            });
            _refreshVoiceModal();
          }
        } else {
          throw Exception(data['error'] ?? '음성 평가 결과를 받지 못했습니다.');
        }
      } else {
        throw Exception('음성 평가에 실패했습니다.');
      }
    } on DioException catch (error) {
      if (error.response?.statusCode == 429) {
        final data = error.response?.data as Map<String, dynamic>?;
        final currentUsage = data?['currentUsage'] as int? ?? 0;
        final maxLimit = data?['maxLimit'] as int? ?? 0;
        final resetDateStr = data?['resetDate'] as String?;
        final resetDate =
            resetDateStr != null ? DateTime.tryParse(resetDateStr) : null;

        if (mounted) {
          setState(() {
            _isEvaluatingVoice = false;
          });
          _refreshVoiceModal();
          Navigator.of(context).pop(); // 음성 모달 닫기
          await showDialog(
            context: context,
            barrierDismissible: true,
            builder:
                (_) => UsageLimitModal(
                  onClose: () => Navigator.of(context).pop(),
                  currentUsage: currentUsage,
                  maxLimit: maxLimit,
                  serviceType: 'productivity',
                  resetDate: resetDate,
                ),
          );
        }
        return;
      }
      print('❌ 음성 평가 오류: $error');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('음성 평가 중 오류가 발생했습니다: ${error.toString()}')),
      );
    } catch (e) {
      print('❌ 음성 평가 오류: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('음성 평가 중 오류가 발생했습니다: ${e.toString()}')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isEvaluatingVoice = false;
        });
      }
      _refreshVoiceModal();
      _tryStartVoiceModalTutorial();
    }
  }

  Future<void> _evaluateTranscribedAnswer(
    String transcript, {
    int? questionIndex,
  }) async {
    final cleaned = transcript.trim();
    final targetIndex = questionIndex ?? _currentQuestionIndex;
    if (cleaned.isEmpty ||
        _questions.isEmpty ||
        targetIndex >= _questions.length) {
      if (mounted) {
        setState(() {
          _answerEvaluationError = '분석할 음성 텍스트가 없습니다.';
        });
      }
      _refreshVoiceModal();
      return;
    }

    final currentQuestion = _questions[targetIndex];

    if (mounted) {
      setState(() {
        _isEvaluatingAnswer = true;
        if (targetIndex == _currentQuestionIndex) {
          _answerEvaluation = null;
          _answerEvaluationError = null;
        }
      });
    }
    _refreshVoiceModal();

    try {
      final dio = await _createAuthorizedDio();
      final response = await dio.post(
        '/api/interview-prep/evaluate-answer',
        data: {
          'question': currentQuestion.question,
          'answer': cleaned,
          'category': currentQuestion.category,
          'jobTitle': _jobTitleController.text.trim(),
          'companyName': _companyNameController.text.trim(),
        },
        options: Options(
          headers: {'X-Requested-With': 'moa_interview_flutter'},
        ),
      );

      if (response.statusCode == 200 && response.data['success'] == true) {
        if (mounted) {
          setState(() {
            // 현재 질문에 평가 결과 저장
            if (targetIndex < _questions.length) {
              _questions[targetIndex].evaluation = response.data['evaluation'];
            }
            if (targetIndex == _currentQuestionIndex) {
              _answerEvaluation = response.data['evaluation'];
            }
          });
        }
      } else {
        final message = response.data['error'] ?? 'AI 분석 결과를 받지 못했습니다.';
        if (mounted) {
          setState(() {
            _answerEvaluationError = message;
          });
        }
      }
    } on DioException catch (dioError) {
      final errorData = dioError.response?.data;
      final message =
          errorData is Map && errorData['error'] is String
              ? errorData['error'] as String
              : dioError.message ?? 'AI 분석 중 오류가 발생했습니다.';
      if (mounted) {
        setState(() {
          _answerEvaluationError = message;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _answerEvaluationError = 'AI 분석 중 오류가 발생했습니다: ${e.toString()}';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isEvaluatingAnswer = false;
        });
      }
      _refreshVoiceModal();
    }
  }

  void _showVoiceFeedbackModal() async {
    if (_questions.isEmpty || _currentQuestionIndex >= _questions.length) {
      return;
    }

    final currentQuestion = _questions[_currentQuestionIndex];
    if (_recordedAudioPath == null && currentQuestion.voiceEvaluation == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('녹음된 음성이 없습니다.')));
      return;
    }

    if (_recordedAudioPath == null && currentQuestion.voiceEvaluation != null) {
      if (!mounted) return;
      setState(_hydratePracticeStateFromCurrentQuestion);
    }

    final bool needsEvaluation =
        !_isEvaluatingVoice && (_lastEvaluatedQuestionId != currentQuestion.id);

    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    final wantVoiceModalTutorial =
        !(prefs.getBool('has_seen_voice_feedback_modal_tutorial') ?? false);
    if (wantVoiceModalTutorial) {
      setState(() => _pendingVoiceModalTutorial = true);
    }

    // 모달 표시
    final modalFuture = showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      isDismissible: false,
      builder:
          (modalContext) => PopScope(
            canPop: !_isEvaluatingVoice,
            child: StatefulBuilder(
              builder: (context, setModalState) {
                _voiceModalSetState = setModalState;
                return AnimatedPadding(
                  duration: const Duration(milliseconds: 150),
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).viewInsets.bottom,
                  ),
                  child: Container(
                    height: MediaQuery.of(context).size.height * 0.85,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(20),
                      ),
                    ),
                    child: Stack(
                      key: _voiceModalStackKey,
                      fit: StackFit.expand,
                      clipBehavior: Clip.none,
                      children: [
                        Column(
                          children: [
                            // 핸들
                            Container(
                              margin: const EdgeInsets.only(top: 12, bottom: 8),
                              width: 40,
                              height: 4,
                              decoration: BoxDecoration(
                                color: const Color(0xFFD1D5DB),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),

                            // 헤더
                            Padding(
                              padding: const EdgeInsets.all(20),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.mic,
                                    color: Color(0xFF795548),
                                    size: 24,
                                  ),
                                  const SizedBox(width: 8),
                                  const Expanded(
                                    child: Text(
                                      '음성 평가',
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF581C87), // purple-900
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.close),
                                    onPressed:
                                        _isEvaluatingVoice
                                            ? null
                                            : () => Navigator.pop(modalContext),
                                  ),
                                ],
                              ),
                            ),

                            const Divider(height: 1),
                            KeyedSubtree(
                              key: _voiceModalTabsKey,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                  vertical: 12,
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: _isEvaluatingVoice
                                                ? const SizedBox()
                                                : _activeVoiceModalView ==
                                                    _VoiceModalView.text
                                                ? _buildVoiceModalTabButton(
                                                    _VoiceModalView.text,
                                                    '답변 분석',
                                                    Icons.article_outlined,
                                                  )
                                                : _buildVoiceModalTabButton(
                                                    _VoiceModalView.text,
                                                    '답변 분석',
                                                    Icons.article_outlined,
                                                  ),
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: _buildVoiceModalTabButton(
                                              _VoiceModalView.voice,
                                              '음성 평가',
                                              Icons.equalizer,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                  ],
                                ),
                              ),
                            ),

                            // 콘텐츠
                            Expanded(
                              child:
                                  _isEvaluatingVoice
                                      ? const Center(
                                        child: Column(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            SizedBox(
                                              width: 48,
                                              height: 48,
                                              child: CircularProgressIndicator(
                                                strokeWidth: 4,
                                                valueColor:
                                                    AlwaysStoppedAnimation<
                                                      Color
                                                    >(
                                                      Color(0xFF795548),
                                                    ),
                                              ),
                                            ),
                                            SizedBox(height: 16),
                                            Text(
                                              'AI가 음성을 분석하고 있습니다...',
                                              style: TextStyle(
                                                fontSize: 16,
                                                color: Color(0xFF6B7280),
                                              ),
                                            ),
                                          ],
                                        ),
                                      )
                                      : _activeVoiceModalView ==
                                          _VoiceModalView.voice
                                      ? (_voiceEvaluation != null
                                          ? _buildVoiceEvaluationTab()
                                          : const Center(
                                            child: Text(
                                              '음성 평가를 시작합니다...',
                                              style: TextStyle(
                                                color: Color(0xFF6B7280),
                                              ),
                                            ),
                                          ))
                                      : _buildTextAnalysisTab(),
                            ),
                          ],
                        ),
                        if (_voiceModalTutorialStep != null)
                          Positioned.fill(
                            child: VoiceFeedbackModalTutorialOverlay(
                              key: ValueKey<int>(
                                _voiceModalTutorialStep!,
                              ),
                              stackKey: _voiceModalStackKey,
                              step: _voiceModalTutorialStep!,
                              hasTranscript:
                                  _transcribedTextController.text
                                      .trim()
                                      .isNotEmpty,
                              hasAnswerEvaluation: _answerEvaluation != null,
                              tabsKey: _voiceModalTabsKey,
                              transcriptKey: _voiceModalTranscriptKey,
                              answerAnalysisHeaderKey:
                                  _voiceModalAnswerAnalysisHeaderKey,
                              answerAnalysisBodyKey:
                                  _voiceModalAnswerAnalysisBodyKey,
                              answerResultKey: _voiceModalAiAnswerResultKey,
                              answerStrengthsKey: _voiceModalAnswerStrengthsKey,
                              answerImprovementsKey:
                                  _voiceModalAnswerImprovementsKey,
                              answerRecommendationsKey:
                                  _voiceModalAnswerRecommendationsKey,
                              answerImprovedExampleKey:
                                  _voiceModalAnswerImprovedExampleKey,
                              voiceOverallKey: _voiceModalVoiceOverallKey,
                              voiceDetailKey: _voiceModalVoiceDetailKey,
                              voiceStrengthsKey: _voiceModalVoiceStrengthsKey,
                              voiceImprovementsKey:
                                  _voiceModalVoiceImprovementsKey,
                              voiceRecommendationsKey:
                                  _voiceModalVoiceRecommendationsKey,
                              onTap: () {
                                unawaited(_advanceVoiceModalTutorial());
                              },
                            ),
                          ),
                        if (_isEvaluatingVoice || _isEvaluatingAnswer)
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
                                              'assets/lottie/interview_analyzing_owl.json',
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
                                          const _DynamicLoadingText(),
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
                  ),
                );
              },
            ),
          ),
    );

    modalFuture.whenComplete(() {
      _voiceModalSetState = null;
      if (mounted) {
        setState(() {
          _voiceModalTutorialStep = null;
          _pendingVoiceModalTutorial = false;
        });
      }
    });

    if (!needsEvaluation && wantVoiceModalTutorial) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _tryStartVoiceModalTutorial();
      });
    }

    if (needsEvaluation) {
      Future.microtask(() {
        _evaluateVoice(questionIndex: _currentQuestionIndex);
      });
    }
  }

  Widget _buildVoiceEvaluationTab() {
    if (_voiceEvaluation == null) {
      return const SizedBox();
    }

    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      key: const PageStorageKey('voice-evaluation-scroll'),
      controller: _voiceEvaluationScrollController,
      primary: false,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 종합 점수
          KeyedSubtree(
            key: _voiceModalVoiceOverallKey,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: const Color(0xFFD7CCC8)), // purple-200
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Column(
                  children: [
                    Text(
                      '${_voiceEvaluation!['overallScore']}/10',
                      style: const TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF111827), // neutral-900
                      ),
                    ),
                    const Text(
                      '종합 음성 점수',
                      style: TextStyle(fontSize: 16, color: Color(0xFF111827)),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // 세부 평가
          KeyedSubtree(
            key: _voiceModalVoiceDetailKey,
            child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xFFD7CCC8)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '📊 세부 평가',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF581C87),
                  ),
                ),
                const SizedBox(height: 12),
                _buildEvaluationItem('음성 톤', _voiceEvaluation!['tone'] ?? ''),
                _buildEvaluationItem('말하기 속도', _voiceEvaluation!['pace'] ?? ''),
                _buildEvaluationItem('음량', _voiceEvaluation!['volume'] ?? ''),
                _buildEvaluationItem('명료도', _voiceEvaluation!['clarity'] ?? ''),
                _buildEvaluationItem(
                  '자신감',
                  _voiceEvaluation!['confidence'] ?? '',
                ),
                _buildEvaluationItem(
                  '표현력',
                  _voiceEvaluation!['expressiveness'] ?? '',
                ),
                _buildEvaluationItem(
                  '구조화',
                  _voiceEvaluation!['structure'] ?? '',
                ),
              ],
            ),
          ),
          ),
          const SizedBox(height: 16),

          // 강점
          KeyedSubtree(
            key: _voiceModalVoiceStrengthsKey,
            child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFD1FAE5), // green-100
              border: Border.all(color: const Color(0xFF86EFAC)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      Icons.check_circle,
                      color: Color(0xFF059669),
                      size: 18,
                    ),
                    SizedBox(width: 6),
                    Text(
                      '🟢 강점',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF065F46), // green-900
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ...((_voiceEvaluation!['strengths'] as List?)?.map(
                      (strength) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF5), // green-50
                            borderRadius: BorderRadius.circular(8),
                            border: const Border(
                              left: BorderSide(
                                color: Color(0xFF34D399),
                                width: 3,
                              ),
                            ),
                          ),
                          child: Text(
                            strength.toString(),
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF065F46),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ) ??
                    []),
              ],
            ),
          ),
          ),
          const SizedBox(height: 16),

          // 개선점
          KeyedSubtree(
            key: _voiceModalVoiceImprovementsKey,
            child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFEE2E2), // red-100
              border: Border.all(color: const Color(0xFFFECACA)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      Icons.error_outline,
                      color: Color(0xFFDC2626),
                      size: 18,
                    ),
                    SizedBox(width: 6),
                    Text(
                      '🔴 개선점 (중요)',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF7F1D1D), // red-900
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ...((_voiceEvaluation!['improvements'] as List?)?.map(
                      (improvement) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF2F2), // red-50
                            borderRadius: BorderRadius.circular(8),
                            border: const Border(
                              left: BorderSide(
                                color: Color(0xFFF87171),
                                width: 3,
                              ),
                            ),
                          ),
                          child: Text(
                            improvement.toString(),
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF7F1D1D),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ) ??
                    []),
              ],
            ),
          ),
          ),
          const SizedBox(height: 16),

          // 추천사항
          KeyedSubtree(
            key: _voiceModalVoiceRecommendationsKey,
            child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF8E1), // blue-50
              border: Border.all(color: const Color(0xFFFFE082)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.lightbulb, color: Color(0xFFFFC107), size: 18),
                    SizedBox(width: 6),
                    Text(
                      '💡 추천사항',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF5D4037), // blue-900
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ...((_voiceEvaluation!['recommendations'] as List?)?.map(
                      (recommendation) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              '• ',
                              style: TextStyle(
                                fontSize: 13,
                                color: Color(0xFFFFC107),
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Expanded(
                              child: Text(
                                recommendation.toString(),
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFFFF8F00),
                                  height: 1.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ) ??
                    []),
              ],
            ),
          ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextAnalysisTab() {
    final hasTranscript = _transcribedTextController.text.trim().isNotEmpty;
    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      key: const PageStorageKey('text-analysis-scroll'),
      controller: _textAnalysisScrollController,
      primary: false,
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasTranscript) ...[
            KeyedSubtree(
              key: _voiceModalTranscriptKey,
              child: _buildTranscribedTextCard(),
            ),
            const SizedBox(height: 16),
          ],
          _buildAnswerAnalysisSection(),
        ],
      ),
    );
  }

  Widget _buildEvaluationItem(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFFAF5FF), // purple-50
          borderRadius: BorderRadius.circular(6),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$label:',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF581C87), // purple-900
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF4E342E), // purple-700
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTranscribedTextCard() {
    final text = _transcribedTextController.text;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.notes, color: Colors.black, size: 18),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  '인식된 답변 텍스트',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Colors.black,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.copy, size: 18, color: Colors.black),
                tooltip: '텍스트 복사',
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: text));
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('인식된 텍스트를 복사했습니다.')),
                  );
                },
              ),
              IconButton(
                icon: const Icon(
                  Icons.flag_outlined,
                  size: 18,
                  color: Colors.black,
                ),
                tooltip: '신고',
                onPressed: _showReportModal,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF9CA3AF), width: 1.5),
            ),
            child: TextField(
              controller: _transcribedTextController,
              minLines: 4,
              maxLines: null,
              onChanged: (value) {
                setState(() {
                  _transcribedText = value;
                  // 텍스트 수정 시에도 현재 질문에 답변 저장
                  if (_currentQuestionIndex < _questions.length) {
                    _questions[_currentQuestionIndex].answer = value;
                  }
                });
              },
              decoration: const InputDecoration(
                border: InputBorder.none,
                isCollapsed: true,
              ),
              style: const TextStyle(
                fontSize: 13,
                height: 1.6,
                color: Colors.black87,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnswerAnalysisSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F3FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFFECB3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KeyedSubtree(
            key: _voiceModalAnswerAnalysisHeaderKey,
            child: Row(
              children: [
                const Icon(Icons.analytics_outlined, color: Color(0xFF5D4037)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        '답변 분석',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF3E2723),
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '음성에서 추출한 텍스트로 질문 답변 품질을 함께 점검해요.',
                        style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed:
                      (_transcribedTextController.text.trim().isEmpty ||
                              _isEvaluatingAnswer)
                          ? null
                          : () => _evaluateTranscribedAnswer(
                            _transcribedTextController.text,
                          ),
                  icon: const Icon(Icons.refresh, size: 18),
                  label: Text(_answerEvaluation != null ? '재분석' : '분석 다시 실행'),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF5D4037),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          KeyedSubtree(
            key: _voiceModalAnswerAnalysisBodyKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_isEvaluatingAnswer)
                  _buildAnswerLoadingIndicator()
                else if (_answerEvaluation != null)
                  _buildAnswerEvaluationDetails()
                else if (_answerEvaluationError != null)
                  _buildAnswerAnalysisErrorView()
                else
                  const Text(
                    'AI가 음성 텍스트를 분석하면 결과가 표시됩니다.',
                    style: TextStyle(color: Color(0xFF6B7280), fontSize: 13),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAnswerLoadingIndicator() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Column(
          children: [
            SizedBox(
              width: 36,
              height: 36,
              child: CircularProgressIndicator(
                strokeWidth: 4,
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF5D4037)),
              ),
            ),
            SizedBox(height: 12),
            Text(
              'AI가 답변을 분석하고 있습니다...',
              style: TextStyle(color: Color(0xFF6B7280)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAnswerAnalysisErrorView() {
    final hasTranscript = _transcribedTextController.text.trim().isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFFFEE2E2),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFECACA)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.error_outline, color: Color(0xFFDC2626)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _answerEvaluationError ?? 'AI 분석 중 오류가 발생했습니다.',
                  style: const TextStyle(
                    color: Color(0xFFB91C1C),
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (hasTranscript) ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed:
                _isEvaluatingAnswer
                    ? null
                    : () => _evaluateTranscribedAnswer(
                      _transcribedTextController.text,
                    ),
            icon: const Icon(Icons.refresh),
            label: const Text('다시 분석하기'),
          ),
        ],
      ],
    );
  }

  Widget _buildAnswerEvaluationDetails() {
    final evaluation = _answerEvaluation!;
    final totalScore = evaluation['totalScore'];
    final Map<String, dynamic> scoreMap = Map<String, dynamic>.from(
      (evaluation['scores'] as Map?) ?? {},
    );
    final strengths = _stringList(evaluation['strengths']);
    final improvements = _stringList(evaluation['improvements']);
    final recommendations = _stringList(evaluation['recommendations']);
    final improvedExample =
        (evaluation['improvedExample']?.toString() ?? '').trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KeyedSubtree(
          key: _voiceModalAiAnswerResultKey,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFFECB3)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.star, color: Color(0xFF4338CA)),
                    const SizedBox(width: 8),
                    const Text(
                      'AI 평가 결과',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF312E81),
                    ),
                  ),
                  const Spacer(),
                  if (totalScore != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFECB3),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '점수: ${_formatScore(totalScore)}/10',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF312E81),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              _buildAnswerScoreGrid(scoreMap),
            ],
          ),
        ),
        ),
        const SizedBox(height: 16),
        if (strengths.isNotEmpty)
          KeyedSubtree(
            key: _voiceModalAnswerStrengthsKey,
            child: _buildAnswerListCard(
              title: '강점',
              icon: Icons.check_circle,
              iconColor: const Color(0xFF047857),
              textColor: const Color(0xFF064E3B),
              backgroundColor: const Color(0xFFD1FAE5),
              items: strengths,
            ),
          ),
        if (strengths.isNotEmpty) const SizedBox(height: 12),
        if (improvements.isNotEmpty)
          KeyedSubtree(
            key: _voiceModalAnswerImprovementsKey,
            child: _buildAnswerListCard(
              title: '개선점',
              icon: Icons.error_outline,
              iconColor: const Color(0xFFB45309),
              textColor: const Color(0xFF78350F),
              backgroundColor: const Color(0xFFFDE68A),
              items: improvements,
            ),
          ),
        if (improvements.isNotEmpty) const SizedBox(height: 12),
        if (recommendations.isNotEmpty)
          KeyedSubtree(
            key: _voiceModalAnswerRecommendationsKey,
            child: _buildAnswerListCard(
              title: '추천사항',
              icon: Icons.lightbulb_outline,
              iconColor: const Color(0xFF5D4037),
              textColor: const Color(0xFF3E2723),
              backgroundColor: const Color(0xFFEFEBE9),
              items: recommendations,
            ),
          ),
        if (recommendations.isNotEmpty) const SizedBox(height: 16),
        if (improvedExample.isNotEmpty)
          KeyedSubtree(
            key: _voiceModalAnswerImprovedExampleKey,
            child: _buildImprovedExampleCard(improvedExample),
          ),
      ],
    );
  }

  Widget _buildAnswerScoreGrid(Map<String, dynamic> scores) {
    const labels = {
      'clarity': '명확성',
      'specificity': '구체성',
      'relevance': '관련성',
      'structure': '구조화',
      'impact': '전달력',
    };

    final tiles =
        labels.entries.map((entry) {
          final colors = _scoreTileColors(entry.key);
          return _buildAnswerScoreTile(entry.value, scores[entry.key], colors);
        }).toList();

    final children = <Widget>[];
    for (var i = 0; i < tiles.length; i += 2) {
      children.add(
        Row(
          children: [
            Expanded(child: tiles[i]),
            const SizedBox(width: 12),
            if (i + 1 < tiles.length)
              Expanded(child: tiles[i + 1])
            else
              const Expanded(child: SizedBox()),
          ],
        ),
      );
      if (i + 2 < tiles.length) {
        children.add(const SizedBox(height: 12));
      }
    }

    return Column(children: children);
  }

  Widget _buildAnswerScoreTile(
    String label,
    dynamic score,
    _ScoreTileColors colors,
  ) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _formatScore(score),
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: colors.accent,
            ),
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 13, color: colors.text)),
        ],
      ),
    );
  }

  _ScoreTileColors _scoreTileColors(String key) {
    switch (key) {
      case 'clarity':
        return const _ScoreTileColors(
          background: Colors.white,
          border: Color(0xFFFFE082),
          accent: Color(0xFFF57C00),
          text: Color(0xFF5D4037),
        );
      case 'specificity':
        return const _ScoreTileColors(
          background: Colors.white,
          border: Color(0xFFD7CCC8),
          accent: Color(0xFF795548),
          text: Color(0xFF4E342E),
        );
      case 'relevance':
        return const _ScoreTileColors(
          background: Colors.white,
          border: Color(0xFF6EE7B7),
          accent: Color(0xFF059669),
          text: Color(0xFF065F46),
        );
      case 'structure':
        return const _ScoreTileColors(
          background: Colors.white,
          border: Color(0xFFFCD34D),
          accent: Color(0xFFD97706),
          text: Color(0xFF92400E),
        );
      case 'impact':
        return const _ScoreTileColors(
          background: Colors.white,
          border: Color(0xFFFDE68A),
          accent: Color(0xFFD97706),
          text: Color(0xFF92400E),
        );
      default:
        return const _ScoreTileColors(
          background: Colors.white,
          border: Color(0xFFE2E8F0),
          accent: Color(0xFFF57C00),
          text: Color(0xFF5D4037),
        );
    }
  }

  Widget _buildAnswerListCard({
    required String title,
    required IconData icon,
    required Color iconColor,
    required Color textColor,
    required Color backgroundColor,
    required List<String> items,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: backgroundColor.withOpacity(0.7)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: iconColor, size: 18),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(fontWeight: FontWeight.bold, color: textColor),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '•  ',
                    style: TextStyle(fontSize: 13, color: Color(0xFF374151)),
                  ),
                  Expanded(
                    child: Text(
                      item,
                      style: TextStyle(
                        fontSize: 13,
                        color: textColor,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildImprovedExampleCard(String text) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.chat_bubble_outline, color: Color(0xFF111827)),
              SizedBox(width: 8),
              Text(
                '개선된 답변 예시',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            text,
            style: const TextStyle(
              fontSize: 13,
              height: 1.6,
              color: Color(0xFF374151),
            ),
          ),
        ],
      ),
    );
  }

  String _formatScore(dynamic value) {
    if (value is num) {
      if (value % 1 == 0) return value.toStringAsFixed(0);
      return value.toStringAsFixed(1);
    }
    return '-';
  }

  List<String> _stringList(dynamic source) {
    if (source is List) {
      return source
          .map((e) => e.toString())
          .where((e) => e.trim().isNotEmpty)
          .toList();
    }
    return [];
  }

  String _stringValue(dynamic value) {
    return value?.toString().trim() ?? '';
  }

  Future<void> _showEditAnalysisListField(
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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        map[key] = result;
      });
    });
  }

  Future<void> _showEditAnalysisTextField(String key, String title) async {
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
    });
  }

  Future<void> _saveInterviewSessionToLocalDb() async {
    if (!mounted) return;
    try {
      final summaryQs =
          _questions
              .where((q) => q.evaluation != null || q.voiceEvaluation != null)
              .toList();
      final answerAvg = _meanAnswerScore(summaryQs);
      final voiceAvg = _meanVoiceScore(summaryQs);
      final avg = _combinedAnswerVoiceAverage(answerAvg, voiceAvg) ?? 0.0;
      final firstQ = _questions.isNotEmpty ? _questions.first.question : '';
      final payloads =
          _questions
              .map(
                (q) => InterviewQuestionPayload(
                  serverQuestionId: q.id,
                  category: q.category,
                  question: q.question,
                  difficulty: q.difficulty,
                  tips: q.tips,
                  answer: q.answer,
                  feedback: q.feedback,
                  score: q.score,
                  evaluation: q.evaluation,
                  voiceEvaluation: q.voiceEvaluation,
                ),
              )
              .toList();
      await InterviewRecordDb.instance.insertSession(
        userId: _auth.currentUser?.id,
        companyName: _companyNameController.text.trim(),
        jobTitle: _jobTitleController.text.trim(),
        avgScore: avg,
        firstQuestion: firstQ,
        questions: payloads,
      );
    } catch (e, st) {
      debugPrint('면접 기록 SQLite 저장 실패: $e\n$st');
    }
  }

  /// 면접 연습(질문 n/m)에서 2번째 이후 질문일 때만 시스템 뒤로가기(안드로이드·iOS)로 이전 질문 이동
  bool get _interceptSystemBackForPracticePreviousQuestion =>
      _currentStep == _InterviewStep.practice && _currentQuestionIndex > 0;

  @override
  Widget build(BuildContext context) {
    if (_currentStep == _InterviewStep.feedback &&
        !_sessionRecordSaved &&
        _questions.isNotEmpty) {
      _sessionRecordSaved = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        unawaited(_saveInterviewSessionToLocalDb());
      });
    }
    const cream = Color(0xFFFFFDE7);
    return PopScope(
      canPop: !_interceptSystemBackForPracticePreviousQuestion,
      onPopInvokedWithResult: (bool didPop, dynamic result) {
        if (didPop) return;
        unawaited(_goToPreviousQuestion());
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: const SystemUiOverlayStyle(
          // 투명: 바디 ColoredBox 크림색이 상태 표시줄 뒤까지 보이게 함(상단 흰 띠 방지)
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
          systemNavigationBarColor: Color(0xFFFFFFFF),
          systemNavigationBarIconBrightness: Brightness.dark,
        ),
        child: Stack(
          children: [
            Scaffold(
              backgroundColor: cream,
              body: ColoredBox(
                color: cream,
                child: SafeArea(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: KeyedSubtree(
                      key: ValueKey<String>(_currentStep.name),
                      child: _buildCurrentStep(),
                    ),
                  ),
                ),
              ),
            ),
            if (_isEvaluatingVoice || _isEvaluatingAnswer)
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
                                  'assets/lottie/interview_analyzing_owl.json',
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
                              const _DynamicLoadingText(),
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
      ),
    );
  }

  Widget _buildCurrentStep() {
    switch (_currentStep) {
      case _InterviewStep.input:
        return _buildInputStep();
      case _InterviewStep.questions:
        return _buildQuestionsLoadingStep();
      case _InterviewStep.practice:
        return _buildPracticeStep();
      case _InterviewStep.feedback:
        return _buildFeedbackStep();
    }
  }

  Widget _buildInputStep() {
    // 로그인 체크
    if (!_auth.isLoggedIn) {
      return _buildLoginRequired();
    }

    if (!_setupCacheReady) {
      return _buildProfileSetupLoadingView();
    }

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 300),
      child: _buildBasicFieldsView(),
    );
  }

  /// 캐시 로드 전 빈 입력칸 노출 방지 (스켈레톤 + 로딩)
  Widget _buildProfileSetupLoadingView() {
    return SingleChildScrollView(
      key: const ValueKey('profile-setup-loading'),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Center(
            child: Text(
              '프로필 수정',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Color(0xFF111827),
              ),
            ),
          ),
          const SizedBox(height: 40),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildLoadingSkeletonBar(width: 72, height: 14),
                const SizedBox(height: 10),
                _buildLoadingSkeletonBar(height: 48),
                const SizedBox(height: 20),
                _buildLoadingSkeletonBar(width: 88, height: 14),
                const SizedBox(height: 10),
                _buildLoadingSkeletonBar(height: 48),
                const SizedBox(height: 28),
                Center(
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: const Color(0xFFF59E0B),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Center(
                  child: Text(
                    '저장된 정보를 불러오는 중…',
                    style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoadingSkeletonBar({double? width, double height = 14}) {
    return Container(
      width: width ?? double.infinity,
      height: height,
      decoration: BoxDecoration(
        color: const Color(0xFFE5E7EB),
        borderRadius: BorderRadius.circular(8),
      ),
    );
  }

  Widget _buildBasicFieldsView() {
    return Container(
      color: const Color(0xFFFDFBF7), // 상단 상태표시줄 영역까지 동일한 색상 보장
      child: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          key: const ValueKey('basic-fields'),
          padding: const EdgeInsets.only(
            left: 24,
            right: 24,
            top: 20,
            bottom: 40,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 고급스러운 헤더 영역
              const Padding(
                padding: EdgeInsets.only(bottom: 28.0),
                child: Column(
                  children: [
                    Text(
                      '프로필 설정',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF4E342E),
                        letterSpacing: -0.5,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'AI 면접 준비를 위한 완벽한 맞춤형 프로필을 완성하세요.',
                      style: TextStyle(
                        fontSize: 14,
                        color: Color(0xFF8D6E63),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),

              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF1F2),
                    border: Border.all(color: const Color(0xFFFECDD3)),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, color: Color(0xFFE11D48)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: const TextStyle(
                            fontSize: 14,
                            color: Color(0xFFBE123C),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
              ],

              // 메인 통합 입력 폼 카드 (딱 한 화면에 다 배치된 프리미엄 카드)
              Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 24,
                      offset: const Offset(0, 8),
                    ),
                  ],
                  border: Border.all(
                    color: const Color(0xFFF3F4F6),
                    width: 1.5,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_experienceProjectsOnlyMode) ...[
                      const Text(
                        '상세 직무 내용 (선택)',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF3F2A23),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _jobDescriptionController,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText:
                              '자세한 직무 내용을 비롯해 본인만의 자기소개서 요약, 지원동기가 있다면 자유롭게 입력해주세요.',
                          hintStyle: const TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontWeight: FontWeight.w500,
                            height: 1.4,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF9FAFB),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: const BorderSide(
                              color: Color(0xFFF59E0B),
                              width: 2,
                            ),
                          ),
                        ),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        '주요 경험 및 성과 (선택)',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF3F2A23),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _experienceController,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText:
                              '경력과 주요 기여 성과, 협업 경험 등을 적어주시면 AI가 깊이있는 면접 꼬리질문을 생성합니다.',
                          hintStyle: const TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontWeight: FontWeight.w500,
                            height: 1.4,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF9FAFB),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: const BorderSide(
                              color: Color(0xFFF59E0B),
                              width: 2,
                            ),
                          ),
                        ),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        '핵심 역량 / 기술 (선택)',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF3F2A23),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _skillsController,
                        maxLines: 1,
                        textAlignVertical: TextAlignVertical.center,
                        keyboardType: TextInputType.text,
                        textInputAction: TextInputAction.done,
                        decoration: InputDecoration(
                          hintText: '예: Flutter, React, 커뮤니케이션, 위기 대응, 마케팅 기획',
                          hintStyle: const TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontWeight: FontWeight.w500,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF9FAFB),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 18,
                            vertical: 10,
                          ),
                          isDense: true,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: const BorderSide(
                              color: Color(0xFFF59E0B),
                              width: 2,
                            ),
                          ),
                        ),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          height: 1.25,
                        ),
                      ),
                    ],
                    if (!_experienceProjectsOnlyMode) ...[
                      // =========================
                      // 1. 기본 정보 (회사, 직무)
                      // =========================
                      const Text(
                        '회사명',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF3F2A23),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _companyNameController,
                        onChanged: (value) => setState(() {}),
                        decoration: InputDecoration(
                          hintText: '예: 네이버, 카카오, 우아한형제들',
                          hintStyle: const TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontWeight: FontWeight.w500,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF9FAFB),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: const BorderSide(
                              color: Color(0xFFF59E0B),
                              width: 2,
                            ),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 18,
                          ),
                        ),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 24),

                      const Text(
                        '지원 직무',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF3F2A23),
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _jobTitleController,
                        onChanged: (value) => setState(() {}),
                        decoration: InputDecoration(
                          hintText: '예: 프론트엔드 개발자, 프로덕트 매니저',
                          hintStyle: const TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontWeight: FontWeight.w500,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF9FAFB),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: BorderSide.none,
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                            borderSide: const BorderSide(
                              color: Color(0xFFF59E0B),
                              width: 2,
                            ),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 18,
                          ),
                        ),
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 16,
                        ),
                      ),
                      if (widget.initialCompanyJobOnly) ...[
                        const SizedBox(height: 24),
                        const Text(
                          '경력 수준',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF3F2A23),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _buildCareerLevelButton(
                                'junior',
                                '신입/주니어',
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _buildCareerLevelButton('mid', '미드레벨'),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _buildCareerLevelButton('senior', '시니어'),
                            ),
                          ],
                        ),
                      ],
                      if (!widget.initialCompanyJobOnly) ...[
                        const SizedBox(height: 28),

                        // 분석 버튼 그룹
                        Row(
                          children: [
                            Expanded(
                              flex: 3,
                              child: Container(
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [
                                      Color(0xFFFBBF24),
                                      Color(0xFFF59E0B),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(
                                        0xFFF59E0B,
                                      ).withOpacity(0.3),
                                      blurRadius: 12,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: ElevatedButton.icon(
                                  onPressed:
                                      _isAnalyzingCompany ||
                                              _companyNameController.text
                                                  .trim()
                                                  .isEmpty ||
                                              _jobTitleController.text
                                                  .trim()
                                                  .isEmpty
                                          ? null
                                          : _analyzeCompany,
                                  icon:
                                      _isAnalyzingCompany
                                          ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2.5,
                                              valueColor:
                                                  AlwaysStoppedAnimation<Color>(
                                                    Colors.white,
                                                  ),
                                            ),
                                          )
                                          : const Icon(
                                            Icons.language_rounded,
                                            size: 20,
                                          ),
                                  label: Text(
                                    _isAnalyzingCompany
                                        ? 'AI 분석 중...'
                                        : (_companyAnalysis != null &&
                                                !_manualInputMode
                                            ? '다시 분석하기'
                                            : 'AI 자동 분석'),
                                    style: const TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 16,
                                    ),
                                    backgroundColor: Colors.transparent,
                                    foregroundColor: Colors.white,
                                    disabledForegroundColor: Colors.white70,
                                    disabledBackgroundColor: const Color(
                                      0xFFE5E7EB,
                                    ),
                                    shadowColor: Colors.transparent,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            if (!_manualInputMode &&
                                !_hideDirectInputButton) ...[
                              const SizedBox(width: 12),
                              Expanded(
                                flex: 2,
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    setState(() {
                                      _manualInputMode = true;
                                      _isAnalysisExpanded = true;
                                      if (_companyAnalysis == null) {
                                        _companyAnalysis = {
                                          'coreValues': <String>[],
                                          'idealCandidate': '',
                                          'vision': '',
                                          'businessAreas': <String>[],
                                          'companyCulture': '',
                                          'keyCompetencies': <String>[],
                                          'originalCompanyName':
                                              _companyNameController.text,
                                        };
                                      }
                                    });
                                  },
                                  icon: const Icon(
                                    Icons.edit_note_rounded,
                                    size: 20,
                                  ),
                                  label: const Text(
                                    '직접 입력',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 16,
                                    ),
                                    backgroundColor: const Color(0xFFF3F4F6),
                                    foregroundColor: const Color(0xFF4B5563),
                                    elevation: 0,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 28),
                      ] else if (_companyAnalysis != null) ...[
                        const SizedBox(height: 8),
                      ],

                      // 분석 결과 슬라이드 (결과 있을 시에만)
                      if (_companyAnalysis != null) ...[
                        AnimatedContainer(
                          width: double.infinity,
                          duration: const Duration(milliseconds: 300),
                          curve: Curves.easeOutCubic,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFBEB),
                            border: Border.all(
                              color: const Color(0xFFFDE68A),
                              width: 1.5,
                            ),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              InkWell(
                                onTap:
                                    () => setState(() {
                                      _isAnalysisExpanded =
                                          !_isAnalysisExpanded;
                                      if (_isAnalysisExpanded)
                                        _manualInputMode = true;
                                    }),
                                borderRadius: BorderRadius.circular(20),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 20,
                                    vertical: 18,
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(6),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFEF3C7),
                                          borderRadius: BorderRadius.circular(
                                            8,
                                          ),
                                        ),
                                        child: const Icon(
                                          Icons.auto_awesome_rounded,
                                          color: Color(0xFFD97706),
                                          size: 18,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Builder(
                                          builder: (context) {
                                            final cn =
                                                _companyNameController.text
                                                    .trim();
                                            final title =
                                                cn.isEmpty
                                                    ? '회사 정보 분석'
                                                    : '$cn 회사 정보 분석';
                                            return Text(
                                              title,
                                              style: const TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.w800,
                                                color: Color(0xFF4E342E),
                                                height: 1.35,
                                              ),
                                              maxLines: 2,
                                              softWrap: true,
                                              overflow: TextOverflow.ellipsis,
                                            );
                                          },
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Icon(
                                        _isAnalysisExpanded
                                            ? Icons.keyboard_arrow_up_rounded
                                            : Icons.keyboard_arrow_down_rounded,
                                        color: const Color(0xFF92400E),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              if (_isAnalysisExpanded) ...[
                                const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 20),
                                  child: Divider(
                                    height: 1,
                                    color: Color(0xFFFDE68A),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(20),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          const Icon(
                                            Icons.mode_edit_rounded,
                                            color: Color(0xFFB45309),
                                            size: 18,
                                          ),
                                          const SizedBox(width: 8),
                                          const Expanded(
                                            child: Text(
                                              '세부 항목을 탭하여 직접 수정할 수 있습니다.',
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFFB45309),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 20),
                                      AnalysisListCard(
                                        title: '핵심 가치',
                                        items: _stringList(
                                          _companyAnalysis!['coreValues'],
                                        ),
                                        icon: Icons.flag_rounded,
                                        backgroundColor: Colors.white,
                                        textColor: const Color(0xFF8A4B08),
                                        onEdit:
                                            () => _showEditAnalysisListField(
                                              'coreValues',
                                              '핵심 가치',
                                              Colors.white,
                                              const Color(0xFF8A4B08),
                                            ),
                                        onTapCard:
                                            () => _showEditAnalysisListField(
                                              'coreValues',
                                              '핵심 가치',
                                              Colors.white,
                                              const Color(0xFF8A4B08),
                                            ),
                                      ),
                                      const SizedBox(height: 12),
                                      AnalysisTextCard(
                                        title: '인재상',
                                        content: _stringValue(
                                          _companyAnalysis!['idealCandidate'],
                                        ),
                                        onEdit:
                                            () => _showEditAnalysisTextField(
                                              'idealCandidate',
                                              '인재상',
                                            ),
                                        onTapCard:
                                            () => _showEditAnalysisTextField(
                                              'idealCandidate',
                                              '인재상',
                                            ),
                                      ),
                                      const SizedBox(height: 12),
                                      AnalysisTextCard(
                                        title: '비전/미션',
                                        content: _stringValue(
                                          _companyAnalysis!['vision'],
                                        ),
                                        onEdit:
                                            () => _showEditAnalysisTextField(
                                              'vision',
                                              '비전/미션',
                                            ),
                                        onTapCard:
                                            () => _showEditAnalysisTextField(
                                              'vision',
                                              '비전/미션',
                                            ),
                                      ),
                                      const SizedBox(height: 12),
                                      AnalysisTextCard(
                                        title: '회사 문화',
                                        content: _stringValue(
                                          _companyAnalysis!['companyCulture'],
                                        ),
                                        onEdit:
                                            () => _showEditAnalysisTextField(
                                              'companyCulture',
                                              '회사 문화',
                                            ),
                                        onTapCard:
                                            () => _showEditAnalysisTextField(
                                              'companyCulture',
                                              '회사 문화',
                                            ),
                                      ),
                                      const SizedBox(height: 12),
                                      AnalysisListCard(
                                        title: '주요 사업분야',
                                        items: _stringList(
                                          _companyAnalysis!['businessAreas'],
                                        ),
                                        icon: Icons.business_center_rounded,
                                        backgroundColor: Colors.white,
                                        textColor: const Color(0xFF1B5E20),
                                        onEdit:
                                            () => _showEditAnalysisListField(
                                              'businessAreas',
                                              '주요 사업분야',
                                              Colors.white,
                                              const Color(0xFF1B5E20),
                                            ),
                                        onTapCard:
                                            () => _showEditAnalysisListField(
                                              'businessAreas',
                                              '주요 사업분야',
                                              Colors.white,
                                              const Color(0xFF1B5E20),
                                            ),
                                      ),
                                      const SizedBox(height: 12),
                                      AnalysisListCard(
                                        title: '중요 역량',
                                        items: _stringList(
                                          _companyAnalysis!['keyCompetencies'],
                                        ),
                                        icon: Icons.stars_rounded,
                                        backgroundColor: Colors.white,
                                        textColor: const Color(0xFF4E342E),
                                        onEdit:
                                            () => _showEditAnalysisListField(
                                              'keyCompetencies',
                                              '중요 역량',
                                              Colors.white,
                                              const Color(0xFF4E342E),
                                            ),
                                        onTapCard:
                                            () => _showEditAnalysisListField(
                                              'keyCompetencies',
                                              '중요 역량',
                                              Colors.white,
                                              const Color(0xFF4E342E),
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: 28),
                      ],

                      // =========================
                      // 2. 추가/상세 정보 이어서 (하나의 화면에 통합)
                      // =========================
                      if (!widget.initialCompanyJobOnly) ...[
                        const Padding(
                          padding: EdgeInsets.only(top: 8.0, bottom: 20.0),
                          child: Divider(
                            color: Color(0xFFF3F4F6),
                            thickness: 1.5,
                          ),
                        ),

                        const Text(
                          '경력 수준',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF3F2A23),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _buildCareerLevelButton(
                                'junior',
                                '신입/주니어',
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _buildCareerLevelButton('mid', '미드레벨'),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _buildCareerLevelButton('senior', '시니어'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 28),

                        const Text(
                          '상세 직무 내용 (선택)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF3F2A23),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _jobDescriptionController,
                          maxLines: 4,
                          decoration: InputDecoration(
                            hintText:
                                '자세한 직무 내용을 비롯해 본인만의 자기소개서 요약, 지원동기가 있다면 자유롭게 입력해주세요.',
                            hintStyle: const TextStyle(
                              color: Color(0xFF9CA3AF),
                              fontWeight: FontWeight.w500,
                              height: 1.4,
                            ),
                            filled: true,
                            fillColor: const Color(0xFFF9FAFB),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(
                                color: Color(0xFFF59E0B),
                                width: 2,
                              ),
                            ),
                          ),
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 24),

                        const Text(
                          '주요 경험 및 성과 (선택)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF3F2A23),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _experienceController,
                          maxLines: 4,
                          decoration: InputDecoration(
                            hintText:
                                '경력과 주요 기여 성과, 협업 경험 등을 적어주시면 AI가 깊이있는 면접 꼬리질문을 생성합니다.',
                            hintStyle: const TextStyle(
                              color: Color(0xFF9CA3AF),
                              fontWeight: FontWeight.w500,
                              height: 1.4,
                            ),
                            filled: true,
                            fillColor: const Color(0xFFF9FAFB),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(
                                color: Color(0xFFF59E0B),
                                width: 2,
                              ),
                            ),
                          ),
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 24),

                        const Text(
                          '핵심 역량 / 기술 (선택)',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF3F2A23),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _skillsController,
                          maxLines: 1,
                          textAlignVertical: TextAlignVertical.center,
                          keyboardType: TextInputType.text,
                          textInputAction: TextInputAction.done,
                          decoration: InputDecoration(
                            hintText:
                                '예: Flutter, React, 커뮤니케이션, 위기 대응, 마케팅 기획',
                            hintStyle: const TextStyle(
                              color: Color(0xFF9CA3AF),
                              fontWeight: FontWeight.w500,
                            ),
                            filled: true,
                            fillColor: const Color(0xFFF9FAFB),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 10,
                            ),
                            isDense: true,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(
                                color: Color(0xFFF59E0B),
                                width: 2,
                              ),
                            ),
                          ),
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                            height: 1.25,
                          ),
                        ),
                      ],
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // =========================
              // 최종 통합 저장 버튼
              // =========================
              Container(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEA580C), Color(0xFFFBBF24)],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEA580C).withOpacity(0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: ElevatedButton(
                  onPressed:
                      _isSavingProfile || _isLoading
                          ? null
                          : (_experienceProjectsOnlyMode
                              ? _saveProfileAndPopHome
                              : (widget.initialCompanyJobOnly
                                  ? (_companyNameController.text
                                              .trim()
                                              .isEmpty ||
                                          _jobTitleController.text
                                              .trim()
                                              .isEmpty
                                      ? null
                                      : _saveProfileAndPopHome)
                                  : ((!_manualInputMode &&
                                          _companyAnalysis == null)
                                      ? null
                                      : _saveProfileAndPopHome))),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    backgroundColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFFE5E7EB),
                    disabledForegroundColor: const Color(0xFF9CA3AF),
                    shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _isSavingProfile
                            ? Icons.hourglass_empty_rounded
                            : Icons.check_circle_outline_rounded,
                        size: 22,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _isSavingProfile ? '저장 중...' : '프로필 저장완료',
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCareerLevelButton(String level, String label) {
    final isSelected = _careerLevel == level;
    return InkWell(
      onTap: () => setState(() => _careerLevel = level),
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFFFFBEB) : const Color(0xFFF9FAFB),
          border: Border.all(
            color:
                isSelected ? const Color(0xFFF59E0B) : const Color(0xFFE5E7EB),
            width: isSelected ? 2.0 : 1.5,
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow:
              isSelected
                  ? [
                    BoxShadow(
                      color: const Color(0xFFF59E0B).withOpacity(0.15),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ]
                  : [],
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              color:
                  isSelected
                      ? const Color(0xFFD97706)
                      : const Color(0xFF6B7280),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuestionsLoadingStep() {
    // 리워드 전면 시 로딩 위젯을 제거하지 않는다(제거 시 dispose → 진행률·팁·타이머가 0에서 재시작됨).
    // 광고 중에만 그 위에 크림 오버레이로 가려 깜빡임·비침을 줄인다.
    return Stack(
      fit: StackFit.expand,
      children: [
        const Positioned.fill(
          child: AiInterviewLoadingView(key: ValueKey('loading-step')),
        ),
        if (_rewardedAdVisible)
          const ColoredBox(
            key: ValueKey('loading-step-ad-overlay'),
            color: Color(0xFFFFFDE7),
          ),
      ],
    );
  }

  Widget _buildTutorialBubble() {
    return TweenAnimationBuilder<double>(
      key: const ValueKey('tutorial_bubble_anim'),
      tween: Tween<double>(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 700),
      curve: Curves.elasticOut,
      builder: (context, val, child) {
        return Transform.scale(
          scale: val,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 20.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 12, offset: const Offset(0, 4)),
                    ],
                  ),
                  child: ClipOval(
                    child: Image.asset('assets/images/profile_owl_tutorial.png', width: 68, height: 68, fit: BoxFit.contain),
                  ),
                ),
                const SizedBox(width: 14),
                Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.centerLeft,
                  children: [
                    Container(
                      width: 210,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF4E342E),
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withOpacity(0.15), offset: const Offset(0, 4), blurRadius: 10),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('분석이 끝났어요! 🦉', style: TextStyle(color: Color(0xFFFFD54F), fontWeight: FontWeight.w900, fontSize: 13)),
                          const SizedBox(height: 6),
                          const Text(
                            'AI 피드백을 먼저 읽어보시면 다음\n질문에서 더 훌륭한 답변을 할 수 있어요.',
                            style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      left: -6,
                      child: Transform.rotate(
                        angle: 3.14159 / 4,
                        child: Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: const Color(0xFF4E342E),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFeedbackButton(InterviewQuestion question) {
    bool isEvaluating = _isEvaluatingVoice || _isEvaluatingAnswer;
    bool showHighlight = !_hasSeenFeedbackTutorial && _currentQuestionIndex == 0 && !isEvaluating && question.voiceEvaluation != null;

    Widget btn = ElevatedButton.icon(
      onPressed: isEvaluating
          ? null
          : () async {
              if (!_hasSeenFeedbackTutorial) {
                if (mounted) setState(() => _hasSeenFeedbackTutorial = true);
                final prefs = await SharedPreferences.getInstance();
                await prefs.setBool('has_seen_feedback_tutorial', true);
              }
              _showVoiceFeedbackModal();
            },
      icon: isEvaluating
          ? const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              ),
            )
          : const Icon(Icons.assessment, size: 20),
      label: Text(isEvaluating ? 'AI 분석 중...' : 'AI 피드백 받기'),
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF795548),
        foregroundColor: Colors.white,
        disabledBackgroundColor: const Color(0xFF9CA3AF),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      ),
    );

    return _PulsingFeedbackTutorialBorder(
      key: const ValueKey('feedback_button_wrapper'),
      active: showHighlight,
      child: btn,
    );
  }

  Widget _buildPracticeStep() {
    if (_questions.isEmpty) {
      return const Center(child: Text('질문이 없습니다.'));
    }

    final question = _questions[_currentQuestionIndex];
    final bool isSavingAnswer = _isEvaluatingVoice || _isEvaluatingAnswer;
    final bool canProceed = _canProceedToNextQuestion();
    final bool canTapNext = canProceed && !isSavingAnswer;
    final double practiceBottomPadding = MediaQuery.of(context).padding.bottom;
    final double practiceTopPadding = MediaQuery.of(context).padding.top;

    return Padding(
      padding: EdgeInsets.only(top: practiceTopPadding),
      child: Column(
        key: const ValueKey('practice-step'),
        children: [
          Container(
            // Scaffold(backgroundColor: 0xFFFFFDE7)와 동일 — 본문 크림 톤과 맞춤
            color: const Color(0xFFFFFDE7),
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                if (_currentQuestionIndex > 0)
                  IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: () => _goToPreviousQuestion(),
                  )
                else
                  const SizedBox(width: 48),
                Expanded(
                  child: Text(
                    '질문 ${_currentQuestionIndex + 1}/${_questions.length}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.start,
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_companyAnalysis != null)
                      TextButton.icon(
                        onPressed: _showCompanyKeywordsModal,
                        icon: const Icon(
                          Icons.label_outline,
                          color: Color(0xFFF59E0B),
                          size: 18,
                        ),
                        label: const Text(
                          '키워드',
                          style: TextStyle(
                            color: Color(0xFFF59E0B),
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        style: TextButton.styleFrom(
                          foregroundColor: const Color(0xFFF59E0B),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                          ),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    TextButton.icon(
                      onPressed: _showTipsDialog,
                      icon: const Icon(
                        Icons.lightbulb_outline,
                        color: Color(0xFFF59E0B),
                        size: 18,
                      ),
                      label: const Text(
                        '가이드',
                        style: TextStyle(
                          color: Color(0xFFF59E0B),
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFFF59E0B),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                        ),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: SingleChildScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                        // 카테고리 & 난이도
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF3C7), // pink-50
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                question.category,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFBE185D), // pink-700
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: _getDifficultyColor(
                                  question.difficulty,
                                ).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                _getDifficultyLabel(question.difficulty),
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: _getDifficultyColor(
                                    question.difficulty,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),

                        // 질문 — 긴 텍스트는 스크롤 영역 안에서만 확장
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFFE5E7EB)),
                          ),
                          child: Text(
                            question.question,
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF111827),
                              height: 1.6,
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // 타이머
                        Center(
                          child: Column(
                            children: [
                              Text(
                                _formatTime(_answerTime),
                                style: const TextStyle(
                                  fontSize: 48,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFF59E0B), // pink-500
                                ),
                              ),
                              const SizedBox(height: 12),
                              if (_isRecording) ...[
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(
                                      Icons.volume_up,
                                      size: 18,
                                      color: Color(0xFF4B5563),
                                    ),
                                    const SizedBox(width: 8),
                                    Container(
                                      width: 160,
                                      height: 12,
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFE5E7EB),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: const Color(0xFFD1D5DB),
                                        ),
                                      ),
                                      child: Align(
                                        alignment: Alignment.centerLeft,
                                        child: AnimatedContainer(
                                          duration: const Duration(
                                            milliseconds: 200,
                                          ),
                                          curve: Curves.easeOut,
                                          width: 160 * _smoothAudioLevel,
                                          height: 12,
                                          decoration: const BoxDecoration(
                                            gradient: LinearGradient(
                                              colors: [
                                                Color(0xFF34D399),
                                                Color(0xFF10B981),
                                              ],
                                            ),
                                            borderRadius: BorderRadius.all(
                                              Radius.circular(6),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    SizedBox(
                                      width: 40,
                                      child: Text(
                                        '${(_smoothAudioLevel * 100).round()}%',
                                        textAlign: TextAlign.center,
                                        style: const TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF374151),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 16),
                              ] else
                                const SizedBox(height: 28),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  ElevatedButton.icon(
                                    onPressed:
                                        _isRecording
                                            ? _stopRecording
                                            : (_isTimerRunning
                                                ? _stopTimer
                                                : _startRecording),
                                    icon: Icon(
                                      _isRecording
                                          ? Icons.stop
                                          : (_isTimerRunning
                                              ? Icons.pause
                                              : Icons.play_arrow),
                                    ),
                                    label: Text(
                                      _isRecording
                                          ? '녹음 정지'
                                          : (_isTimerRunning ? '일시정지' : '시작'),
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(
                                        0xFFF59E0B,
                                      ), // pink-500
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 24,
                                        vertical: 12,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  ElevatedButton.icon(
                                    onPressed: _resetTimer,
                                    icon: const Icon(Icons.refresh),
                                    label: const Text('초기화'),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF6B7280),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 24,
                                        vertical: 12,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (_recordedAudioPath != null ||
                                  question.voiceEvaluation != null) ...[
                                const SizedBox(height: 16),
                                if (!_hasSeenFeedbackTutorial && _currentQuestionIndex == 0 && !_isEvaluatingVoice && question.voiceEvaluation != null)
                                  _buildTutorialBubble(),
                                _buildFeedbackButton(question),
                              ],
                            ],
                          ),
                        ),
                ],
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 12,
              bottom: 12 + practiceBottomPadding,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed:
                        canTapNext
                            ? (_currentQuestionIndex < _questions.length - 1
                                ? () {
                                  setState(() {
                                    _currentQuestionIndex++;
                                    _resetTimer();
                                  });
                                }
                                : () async {
                                  setState(() {
                                    _currentStep = _InterviewStep.feedback;
                                  });
                                  // 첫 완료 시 홈 버튼 튜토리얼 표시
                                  final prefs =
                                      await SharedPreferences.getInstance();
                                  final hasSeen =
                                      prefs.getBool(
                                        'has_seen_home_tabs_tutorial',
                                      ) ??
                                      false;
                                  if (!hasSeen && mounted) {
                                    WidgetsBinding.instance
                                        .addPostFrameCallback((_) {
                                          if (mounted) {
                                            setState(
                                              () =>
                                                  _showFeedbackHomeTutorial =
                                                      true,
                                            );
                                          }
                                        });
                                  }
                                })
                            : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFF59E0B),
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: const Color(0xFFD1D5DB),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child:
                        isSavingAnswer
                            ? const Text('저장 중...')
                            : Text(
                              _currentQuestionIndex < _questions.length - 1
                                  ? '다음 질문'
                                  : '완료',
                            ),
                  ),
                ),
                if (!canProceed && !isSavingAnswer) ...[
                  const SizedBox(height: 8),
                  const Text(
                    '이 질문은 녹음을 시작했어요. 저장이 완료되면 다음으로 이동할 수 있습니다.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginRequired() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.lock_outline_rounded,
              size: 48,
              color: Colors.black54,
            ),
            const SizedBox(height: 16),
            const Text(
              'AI 면접 준비 기능을 이용하려면 로그인이 필요합니다.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: 220,
              height: 48,
              child: ElevatedButton(
                onPressed: () async {
                  final result = await Navigator.of(context).push<bool>(
                    MaterialPageRoute(
                      builder:
                          (_) => LoginPage(
                            onBack: () => Navigator.of(context).pop(false),
                            onLoginSuccess:
                                () => Navigator.of(context).pop(true),
                          ),
                    ),
                  );
                  if (result == true && mounted) {
                    setState(() {
                      // 로그인 이후 화면 갱신
                    });
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.black,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: const Text(
                  '로그인 하러 가기',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeedbackStep() {
    final summaryQuestions =
        _questions
            .where((q) => q.evaluation != null || q.voiceEvaluation != null)
            .toList();
    final answerAvg = _meanAnswerScore(summaryQuestions);
    final voiceAvg = _meanVoiceScore(summaryQuestions);
    final totalAverage =
        _combinedAnswerVoiceAverage(answerAvg, voiceAvg) ?? 0.0;

    // 카테고리별: 해당 카테고리 답변 평균·음성 평균을 각각 낸 뒤 (둘 다 있으면) 평균
    final categoryAverages = <String, double>{};
    final categoryGroups = <String, List<InterviewQuestion>>{};
    for (final q in summaryQuestions) {
      categoryGroups.putIfAbsent(q.category, () => []).add(q);
    }
    categoryGroups.forEach((category, questions) {
      final a = _meanAnswerScore(questions);
      final v = _meanVoiceScore(questions);
      final combined = _combinedAnswerVoiceAverage(a, v);
      if (combined != null) {
        categoryAverages[category] = combined;
      }
    });

    return Stack(
      key: _feedbackStackKey,
      children: [
      SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      key: const ValueKey('feedback-step'),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 뒤로가기 버튼 (홈에서 진입 시 메인으로 복귀)
          Align(
            alignment: Alignment.centerLeft,
            child: IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: _popToMainFromFeedback,
            ),
          ),
          const SizedBox(height: 16),

          // 전체 평가 요약
          if (summaryQuestions.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Row(
                    children: const [
                      Icon(Icons.star, color: Color(0xFFF59E0B), size: 24),
                      SizedBox(width: 8),
                      Text(
                        '전체 평가 요약',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF111827),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    '전체 점수',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    formatAiScoreFraction(totalAverage),
                    style: const TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFFFA000),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        '답변 분석 ',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      Text(
                        formatAiScoreFraction(answerAvg),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF374151),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        '음성 평가 ',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                      Text(
                        formatAiScoreFraction(voiceAvg),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF374151),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${summaryQuestions.length}개 질문 평가 완료',
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  if (categoryAverages.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children:
                          categoryAverages.entries.map((entry) {
                            return Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFFDE7),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    entry.value.toStringAsFixed(1),
                                    style: const TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF374151),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    entry.key,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF6B7280),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],

          // 완료 메시지
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: const BoxDecoration(
                    color: Color(0xFFD1FAE5),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_circle,
                    size: 48,
                    color: Color(0xFF059669),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  '면접 준비 완료!',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '총 ${_questions.length}개의 질문에 대한 답변을 준비했습니다.',
                  style: const TextStyle(
                    fontSize: 14,
                    color: Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  key: _feedbackHomeButtonKey,
                  onPressed: _popToMainFromFeedback,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6B7280),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 14,
                    ),
                  ),
                  child: const Text('홈 화면으로 가기'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // 완료 박스 ↔ 답변 요약 사이 네이티브 광고
          Padding(
            padding: const EdgeInsets.only(bottom: 24),
            child: NativeAdCard(adUnitId: AdmobConfig.resultNativeUnitId),
          ),

          // 답변 요약
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '답변 요약',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 16),
                ..._questions.asMap().entries.map((entry) {
                  final index = entry.key;
                  final question = entry.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Container(
                      padding: const EdgeInsets.only(left: 16),
                      decoration: const BoxDecoration(
                        border: Border(
                          left: BorderSide(color: Color(0xFFF59E0B), width: 4),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Q${index + 1}. ${question.question}',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF111827),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            question.answer != null &&
                                    question.answer!.isNotEmpty
                                ? (question.answer!.length > 100
                                    ? '${question.answer!.substring(0, 100)}...'
                                    : question.answer!)
                                : '답변이 작성되지 않았습니다.',
                            style: const TextStyle(
                              fontSize: 13,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ],
            ),
          ),
        ],
      ),
    ),
    // 완료 화면 홈 버튼 튜토리얼 오버레이
    if (_showFeedbackHomeTutorial)
      _FeedbackHomeTutorialOverlay(
        stackKey: _feedbackStackKey,
        homeButtonKey: _feedbackHomeButtonKey,
        onTap: () => setState(() => _showFeedbackHomeTutorial = false),
      ),
    ],
    );
  }

  Color _getDifficultyColor(String difficulty) {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return const Color(0xFF10B981); // green-500
      case 'hard':
        return const Color(0xFFEF4444); // red-500
      default:
        return const Color(0xFFF59E0B); // amber-500
    }
  }

  String _getDifficultyLabel(String difficulty) {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return '쉬움';
      case 'hard':
        return '어려움';
      default:
        return '보통';
    }
  }
}

/// 면접 완료 화면 — 홈 화면으로 가기 버튼 하이라이트 튜토리얼
class _FeedbackHomeTutorialOverlay extends StatefulWidget {
  const _FeedbackHomeTutorialOverlay({
    required this.stackKey,
    required this.homeButtonKey,
    required this.onTap,
  });

  final GlobalKey stackKey;
  final GlobalKey homeButtonKey;
  final VoidCallback onTap;

  @override
  State<_FeedbackHomeTutorialOverlay> createState() =>
      _FeedbackHomeTutorialOverlayState();
}

class _FeedbackHomeTutorialOverlayState
    extends State<_FeedbackHomeTutorialOverlay> {
  Rect? _holeRect;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateHole());
  }

  Future<void> _updateHole() async {
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return;
    // 버튼이 스크롤 아래에 있으면 먼저 스크롤해서 보이게 함
    final btnCtx = widget.homeButtonKey.currentContext;
    if (btnCtx != null) {
      try {
        await Scrollable.ensureVisible(
          btnCtx,
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOut,
          alignment: 0.5,
        );
      } catch (_) {}
    }
    await WidgetsBinding.instance.endOfFrame;
    if (!mounted) return;
    _recomputeHole();
  }

  void _recomputeHole() {
    final stackCtx = widget.stackKey.currentContext;
    final btnCtx = widget.homeButtonKey.currentContext;
    if (stackCtx == null || btnCtx == null) {
      if (mounted) setState(() => _holeRect = null);
      return;
    }
    final stackBox = stackCtx.findRenderObject() as RenderBox?;
    final btnBox = btnCtx.findRenderObject() as RenderBox?;
    if (stackBox == null || btnBox == null || !btnBox.hasSize || !stackBox.hasSize) {
      if (mounted) setState(() => _holeRect = null);
      return;
    }
    final topLeft = btnBox.localToGlobal(Offset.zero, ancestor: stackBox);
    final rect = (topLeft & btnBox.size).inflate(8);
    if (mounted) setState(() => _holeRect = rect);
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final holeTop = _holeRect?.top ?? (mq.size.height * 0.45);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.onTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: _FeedbackDimPainter(
                hole: _holeRect,
                overlayColor: Colors.black.withValues(alpha: 0.6),
              ),
            ),
          ),
          if (_holeRect != null)
            Positioned.fill(
              child: CustomPaint(
                painter: _FeedbackHoleBorderPainter(rect: _holeRect!),
              ),
            ),
          Positioned(
            left: 16,
            right: 16,
            top: holeTop + (_holeRect?.height ?? 0) + 20,
            child: Material(
              color: Colors.transparent,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF4E342E),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.2),
                      blurRadius: 12,
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      '여기를 눌러 홈으로 돌아가면\n기록과 내 점수에서 결과를 확인할 수 있어요!',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        height: 1.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '화면을 탭하면 안내가 닫혀요',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedbackDimPainter extends CustomPainter {
  _FeedbackDimPainter({required this.hole, required this.overlayColor});
  final Rect? hole;
  final Color overlayColor;

  @override
  void paint(Canvas canvas, Size size) {
    final full = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    if (hole == null || hole!.width <= 0 || hole!.height <= 0) {
      canvas.drawPath(full, Paint()..color = overlayColor);
      return;
    }
    final holePath = Path()
      ..addRRect(RRect.fromRectAndRadius(hole!, const Radius.circular(10)));
    final diff = Path.combine(PathOperation.difference, full, holePath);
    canvas.drawPath(diff, Paint()..color = overlayColor);
  }

  @override
  bool shouldRepaint(covariant _FeedbackDimPainter old) =>
      old.hole != hole || old.overlayColor != overlayColor;
}

class _FeedbackHoleBorderPainter extends CustomPainter {
  _FeedbackHoleBorderPainter({required this.rect});
  final Rect rect;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(10)),
      Paint()
        ..color = const Color(0xFFFFB300)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(covariant _FeedbackHoleBorderPainter old) =>
      old.rect != rect;
}

/// 「AI 피드백 받기」튜토리얼 강조 테두리·글로우 깜빡임 (로컬 UI만)
class _PulsingFeedbackTutorialBorder extends StatefulWidget {
  const _PulsingFeedbackTutorialBorder({
    super.key,
    required this.active,
    required this.child,
  });

  final bool active;
  final Widget child;

  @override
  State<_PulsingFeedbackTutorialBorder> createState() =>
      _PulsingFeedbackTutorialBorderState();
}

class _PulsingFeedbackTutorialBorderState
    extends State<_PulsingFeedbackTutorialBorder>
    with SingleTickerProviderStateMixin {
  static const Color _amber = Color(0xFFFFB300);

  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    if (widget.active) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(_PulsingFeedbackTutorialBorder oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active != oldWidget.active) {
      if (widget.active) {
        _controller.repeat(reverse: true);
      } else {
        _controller
          ..stop()
          ..reset();
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active) {
      return widget.child;
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = Curves.easeInOut.transform(_controller.value);
        final borderOpacity = 0.45 + 0.55 * t;
        final glowStrength = 0.2 + 0.8 * t;
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: _amber.withValues(alpha: borderOpacity),
              width: 3,
            ),
            boxShadow: [
              BoxShadow(
                color: _amber.withValues(alpha: 0.35 * glowStrength),
                blurRadius: 8 + 14 * t,
                spreadRadius: 1 + 3 * t,
              ),
            ],
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

class _DynamicLoadingText extends StatefulWidget {
  const _DynamicLoadingText({super.key});

  @override
  State<_DynamicLoadingText> createState() => _DynamicLoadingTextState();
}

class _DynamicLoadingTextState extends State<_DynamicLoadingText> {
  int _step = 0;
  Timer? _timer;

  final List<String> _messages = [
    '답변을 집중해서 듣고 있어요 🎧',
    '논리 구조를 꼼꼼히 분석합니다 📈',
    '맞춤형 피드백을 작성하고 있어요 📝✨',
  ];

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 5), (timer) {
      if (_step < _messages.length - 1) {
        if (mounted) {
          setState(() {
            _step++;
          });
        }
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 500),
      child: Text(
        _messages[_step],
        key: ValueKey<int>(_step),
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 14,
          height: 1.5,
          letterSpacing: -0.3,
          fontWeight: FontWeight.w600,
          color: Color(0xFF57606F),
        ),
      ),
    );
  }
}
