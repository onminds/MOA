import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'interview_prep_page.dart';
import '../services/interview_prep_setup_cache.dart';

/// 처음 열 때 보이는 칸 수
const int _kInitialQuestionFields = 3;

/// 삭제 후 남길 수 있는 최소 칸 수(1개는 항상 유지)
const int _kMinQuestionFields = 1;

const int _kMaxQuestionFields = 10;

/// 질문란 세로 늘림: 래핑에 따른 최소·최대 줄(넘치면 내부 스크롤)
const int _kQuestionFieldMinLines = 1;
const int _kQuestionFieldMaxLines = 10;

/// 질문 1~10칸별 placeholder (띄어쓰기 포함 각 20자 이하)
const List<String> _kQuestionFieldHints = [
  '예) 지원 동기를 말해주세요',
  '예) 입사 후 목표가 있나요?',
  '예) 팀 갈등은 어떻게 푸시나요?',
  '예) 강점을 짧게 말해보세요',
  '예) 극복한 경험을 말해주세요',
  '예) 이 직무에 지원한 이유는?',
  '예) 5년 뒤 커리어 그림은?',
  '예) 스트레스는 어떻게 푸시나요?',
  '예) 회사에 대해 아는 점이 있나요?',
  '예) 덧붙이고 싶은 말씀은?',
];

/// 「면접 질문 시작」→ 직접 질문 쓰기: 기본 3칸·1~10칸·[InterviewPrepPage]와 동일한 연습 플로우로 진입
class ManualInterviewQuestionsPage extends StatefulWidget {
  const ManualInterviewQuestionsPage({
    super.key,
    this.initialSetupSnapshot,
  });

  final InterviewPrepSetupSnapshot? initialSetupSnapshot;

  @override
  State<ManualInterviewQuestionsPage> createState() =>
      _ManualInterviewQuestionsPageState();
}

class _ManualInterviewQuestionsPageState extends State<ManualInterviewQuestionsPage> {
  final List<TextEditingController> _controllers = [];
  final List<FocusNode> _focusNodes = [];

  @override
  void initState() {
    super.initState();
    assert(
      _kQuestionFieldHints.every((s) => s.length <= 20),
      'placeholder는 띄어쓰기 포함 20자 이하여야 합니다',
    );
    for (var i = 0; i < _kInitialQuestionFields; i++) {
      _controllers.add(TextEditingController());
      _focusNodes.add(FocusNode());
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _onFieldSubmitted(int index) {
    if (index < _focusNodes.length - 1) {
      _focusNodes[index + 1].requestFocus();
    } else {
      FocusManager.instance.primaryFocus?.unfocus();
    }
  }

  void _addField() {
    if (_controllers.length >= _kMaxQuestionFields) return;
    setState(() {
      _controllers.add(TextEditingController());
      _focusNodes.add(FocusNode());
    });
    // 레이아웃 반영 후 방금 추가된 질문란에 키보드 포커스
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _focusNodes.isEmpty) return;
      _focusNodes.last.requestFocus();
    });
  }

  void _removeField(int index) {
    // 질문 칸은 최소 1개는 남겨야 함
    if (_controllers.length <= _kMinQuestionFields) return;
    if (index < 0 || index >= _controllers.length) return;
    setState(() {
      _controllers[index].dispose();
      _focusNodes[index].dispose();
      _controllers.removeAt(index);
      _focusNodes.removeAt(index);
    });
  }

  void _startPractice() {
    final texts =
        _controllers.map((c) => c.text.trim()).where((s) => s.isNotEmpty).toList();
    if (texts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('질문을 한 가지 이상 입력해 주세요.')),
      );
      return;
    }

    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => InterviewPrepPage(
          initialSetupSnapshot: widget.initialSetupSnapshot,
          initialManualQuestionTexts: texts,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFFFDFBF7),
        foregroundColor: const Color(0xFF5D4037),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          tooltip: '뒤로',
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text(
          '직접 질문 쓰기',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: Color(0xFF4E342E),
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 8),
              child: Text(
                '면접에서 나올 법한 질문을 적어 주세요.\n최소 1개 이상 채우면 연습을 시작할 수 있어요.',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF6D4C41).withValues(alpha: 0.9),
                  height: 1.45,
                ),
              ),
            ),
            Expanded(
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                itemCount: _controllers.length,
                separatorBuilder: (_, __) => const SizedBox(height: 14),
                itemBuilder: (context, index) {
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _controllers[index],
                          focusNode: _focusNodes[index],
                          // 박스 너비에 맞게 줄이 바뀌며 아래로 늘어남(실제 \\n은 막아 Enter/완료는 다음·완료 액션에 맡김)
                          minLines: _kQuestionFieldMinLines,
                          maxLines: _kQuestionFieldMaxLines,
                          keyboardType: TextInputType.multiline,
                          textInputAction:
                              index < _controllers.length - 1
                                  ? TextInputAction.next
                                  : TextInputAction.done,
                          inputFormatters: [
                            FilteringTextInputFormatter.deny(
                              RegExp(r'\n'),
                            ),
                          ],
                          onSubmitted: (_) => _onFieldSubmitted(index),
                          decoration: InputDecoration(
                            labelText: '질문 ${index + 1}',
                            hintText: _kQuestionFieldHints[index],
                            alignLabelWithHint: true,
                          ),
                        ),
                      ),
                      if (_controllers.length > _kMinQuestionFields) ...[
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: () => _removeField(index),
                          icon: const Icon(Icons.remove_circle_outline_rounded),
                          color: const Color(0xFFBCAAA4),
                          tooltip: '이 칸 삭제',
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (_controllers.length < _kMaxQuestionFields) ...[
                    OutlinedButton.icon(
                      onPressed: _addField,
                      icon: const Icon(Icons.add_rounded, size: 20),
                      label: Text(
                        '질문 칸 추가 (${_controllers.length}/$_kMaxQuestionFields)',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF5D4037),
                        side: const BorderSide(color: Color(0xFFD7CCC8)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                  FilledButton(
                    onPressed: _startPractice,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF5D4037),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: const Text(
                      '면접 연습 시작',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
