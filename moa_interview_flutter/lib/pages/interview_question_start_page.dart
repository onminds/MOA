import 'package:flutter/material.dart';

import 'interview_prep_page.dart';
import 'manual_interview_questions_page.dart';
import '../services/interview_prep_setup_cache.dart';

/// 홈의 「면접 질문 시작하기」에서 진입 — 기능 선택 제공
class InterviewQuestionStartPage extends StatefulWidget {
  const InterviewQuestionStartPage({
    super.key,
    this.initialSetupSnapshot,
    this.onFirstCompletion,
  });

  final InterviewPrepSetupSnapshot? initialSetupSnapshot;
  final VoidCallback? onFirstCompletion;

  @override
  State<InterviewQuestionStartPage> createState() => _InterviewQuestionStartPageState();
}

class _InterviewQuestionStartPageState extends State<InterviewQuestionStartPage> {
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
          '면접 질문 시작',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: Color(0xFF4E342E),
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(28, 28, 120, 28),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF5D4037), Color(0xFF3E2723)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF3E2723).withValues(alpha: 0.25),
                          blurRadius: 15,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFCA28),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('STEP 1', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF3E2723), letterSpacing: 0.5)),
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          '어떤 방식으로\n연습할까요?',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            height: 1.3,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'AI가 면접 질문을 제안하거나,\n직접 질문을 작성할 수 있어요.',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                            color: Colors.white.withValues(alpha: 0.8),
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    right: -10,
                    bottom: 0,
                    child: IgnorePointer(
                      child: Image.asset(
                        'assets/images/profile_owl_1.png',
                        width: 150,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),
              _ChoiceCard(
                icon: Icons.auto_awesome_rounded,
                iconBg: const Color(0xFFFFF3E0),
                iconColor: const Color(0xFFE65100),
                title: 'AI 맞춤 질문 받기',
                subtitle: '저장된 프로필로 질문을 생성하고 바로\n연습해요',
                isPrimary: true,
                showTrailing: true,
                onTap: () {
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute(
                      builder: (_) => InterviewPrepPage(
                        startInterviewPractice: true,
                        initialSetupSnapshot: widget.initialSetupSnapshot,
                        onFirstCompletion: widget.onFirstCompletion,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 14),
              _ChoiceCard(
                icon: Icons.edit_note_rounded,
                iconBg: const Color(0xFFFFF3E0),
                iconColor: const Color(0xFFE65100),
                title: '직접 질문 쓰기',
                subtitle: '원하는 문장을 스스로 입력해 연습해요',
                isPrimary: true,
                showTrailing: true,
                onTap: () {
                  Navigator.of(context).pushReplacement(
                    MaterialPageRoute<void>(
                      builder: (_) => ManualInterviewQuestionsPage(
                        initialSetupSnapshot: widget.initialSetupSnapshot,
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.isPrimary,
    this.showTrailing = false,
    required this.onTap,
  });

  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final bool isPrimary;
  final bool showTrailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final borderColor = isPrimary
        ? const Color(0xFFFFD54F)
        : const Color(0xFFE5E7EB);
    final shadow = isPrimary
        ? [
            BoxShadow(
              color: const Color(0xFFFFD54F).withValues(alpha: 0.18),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ]
        : [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ];

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: borderColor, width: isPrimary ? 2 : 1),
            boxShadow: shadow,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: Row(
               crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                 Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: iconColor, size: 26),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                       Text(
                        title,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: isPrimary
                              ? const Color(0xFF4E342E)
                              : const Color(0xFF374151),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          height: 1.4,
                          color: isPrimary
                              ? const Color(0xFF8D6E63)
                              : const Color(0xFF9CA3AF),
                        ),
                      ),
                    ],
                  ),
                ),
                if (isPrimary || showTrailing)
                  const Padding(
                    padding: EdgeInsets.only(left: 4, top: 2),
                    child: Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 16,
                      color: Color(0xFFBCAAA4),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
