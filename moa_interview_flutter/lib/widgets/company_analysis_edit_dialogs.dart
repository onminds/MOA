import 'package:flutter/material.dart';

/// 인재상·비전/미션·회사 문화 등 — [TextEditingController]는 다이얼로그가 소유·dispose
class EditTextFieldDialog extends StatefulWidget {
  const EditTextFieldDialog({
    super.key,
    required this.title,
    required this.initialText,
  });

  final String title;
  final String initialText;

  @override
  State<EditTextFieldDialog> createState() => _EditTextFieldDialogState();
}

class _EditTextFieldDialogState extends State<EditTextFieldDialog> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialText);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _pop([String? result]) {
    FocusManager.instance.primaryFocus?.unfocus();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Navigator.of(context).pop(result);
    });
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFFFAF8F5),
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
      ),
      title: Text(
        '${widget.title} 수정',
        style: const TextStyle(
          fontWeight: FontWeight.w800,
          color: Color(0xFF3E2723),
        ),
      ),
      content: SizedBox(
        width: MediaQuery.of(context).size.width,
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: TextField(
            controller: _controller,
            maxLines: 10,
            style: const TextStyle(
              color: Color(0xFF4E342E),
              fontSize: 15,
              height: 1.5,
            ),
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.all(16),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFD7CCC8)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFD7CCC8)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: Color(0xFF5D4037), width: 1.5),
              ),
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => _pop(),
          child: const Text(
            '취소',
            style: TextStyle(
              color: Color(0xFF9E9E9E),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        ElevatedButton(
          onPressed: () => _pop(_controller.text.trim()),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF4E342E),
            foregroundColor: Colors.white,
            elevation: 0,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: const Text(
            '저장',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

/// 핵심 가치·주요 사업분야·주요 역량: 배지 추가·삭제로 수정
class EditListBadgesDialog extends StatefulWidget {
  const EditListBadgesDialog({
    super.key,
    required this.title,
    required this.initialItems,
    required this.chipBackgroundColor,
    required this.chipTextColor,
  });

  final String title;
  final List<String> initialItems;
  final Color chipBackgroundColor;
  final Color chipTextColor;

  @override
  State<EditListBadgesDialog> createState() => _EditListBadgesDialogState();
}

class _EditListBadgesDialogState extends State<EditListBadgesDialog> {
  late List<String> _items;
  final TextEditingController _addController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _items = List<String>.from(widget.initialItems);
  }

  @override
  void dispose() {
    _addController.dispose();
    super.dispose();
  }

  void _addItem() {
    final t = _addController.text.trim();
    if (t.isEmpty) return;
    setState(() {
      _items.add(t);
      _addController.clear();
    });
  }

  void _removeAt(int index) {
    setState(() {
      _items.removeAt(index);
    });
  }

  void _popDialog([List<String>? result]) {
    FocusManager.instance.primaryFocus?.unfocus();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (result == null) {
        Navigator.of(context).pop();
      } else {
        Navigator.of(context).pop(result);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    final maxDialogHeight =
        (mq.size.height - mq.viewInsets.bottom - mq.padding.vertical - 32)
            .clamp(220.0, mq.size.height * 0.92);

    return Dialog(
      backgroundColor: const Color(0xFFFAF8F5),
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: mq.size.width - 32,
          maxHeight: maxDialogHeight,
        ),
        child: SingleChildScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 14),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '${widget.title} 수정',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF3E2723),
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 14),
                if (_items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      '항목이 없습니다. 아래에서 배지를 추가해 주세요.',
                      style: TextStyle(
                        fontSize: 14,
                        color: Color(0xFF6B7280),
                        height: 1.45,
                      ),
                    ),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (var i = 0; i < _items.length; i++)
                        EditBadgeChip(
                          label: _items[i],
                          backgroundColor: widget.chipBackgroundColor,
                          textColor: widget.chipTextColor,
                          onRemove: () => _removeAt(i),
                        ),
                    ],
                  ),
                const SizedBox(height: 16),
                TextField(
                  controller: _addController,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _addItem(),
                  style: const TextStyle(
                    color: Color(0xFF4E342E),
                    fontSize: 15,
                  ),
                  decoration: InputDecoration(
                    hintText: '새 항목 입력',
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 14,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFD7CCC8)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFD7CCC8)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(
                        color: Color(0xFF5D4037),
                        width: 1.5,
                      ),
                    ),
                    suffixIcon: IconButton(
                      tooltip: '추가',
                      onPressed: _addItem,
                      icon: const Icon(Icons.add_circle_outline_rounded),
                      color: const Color(0xFF5D4037),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => _popDialog(),
                      child: const Text(
                        '취소',
                        style: TextStyle(
                          color: Color(0xFF9E9E9E),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    ElevatedButton(
                      onPressed: () => _popDialog(List<String>.from(_items)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4E342E),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 10,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text(
                        '저장',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class EditBadgeChip extends StatelessWidget {
  const EditBadgeChip({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.textColor,
    required this.onRemove,
  });

  final String label;
  final Color backgroundColor;
  final Color textColor;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 280),
        padding: const EdgeInsets.only(left: 12, top: 6, bottom: 6, right: 4),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: textColor,
                  height: 1.25,
                ),
              ),
            ),
            IconButton(
              onPressed: onRemove,
              tooltip: '삭제',
              icon: Icon(
                Icons.close_rounded,
                size: 18,
                color: textColor.withValues(alpha: 0.75),
              ),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
              visualDensity: VisualDensity.compact,
            ),
          ],
        ),
      ),
    );
  }
}

class AnalysisListCard extends StatelessWidget {
  const AnalysisListCard({
    super.key,
    required this.title,
    required this.items,
    required this.icon,
    required this.backgroundColor,
    required this.textColor,
    this.onEdit,
    this.onTapCard,
  });

  final String title;
  final List<String> items;
  final IconData icon;
  final Color backgroundColor;
  final Color textColor;
  final VoidCallback? onEdit;
  /// 카드 전체 탭(온보딩 3단계와 동일한 편집 모달)
  final VoidCallback? onTapCard;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 18, color: textColor),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF111827),
                  ),
                ),
              ),
              if (onEdit != null)
                IconButton(
                  onPressed: onEdit,
                  tooltip: '$title 수정',
                  icon: const Icon(Icons.edit_rounded, size: 20),
                  color: const Color(0xFF6B7280),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                ),
            ],
          ),
          const SizedBox(height: 14),
          if (items.isEmpty)
            const Text(
              '분석된 내용이 없습니다.',
              style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: items
                  .map(
                    (item) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: backgroundColor,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        item,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: textColor,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
    );

    if (onTapCard == null) return card;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTapCard,
        child: card,
      ),
    );
  }
}

class AnalysisTextCard extends StatelessWidget {
  const AnalysisTextCard({
    super.key,
    required this.title,
    required this.content,
    this.onEdit,
    this.onTapCard,
  });

  final String title;
  final String content;
  final VoidCallback? onEdit;
  final VoidCallback? onTapCard;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF111827),
                  ),
                ),
              ),
              if (onEdit != null)
                IconButton(
                  onPressed: onEdit,
                  tooltip: '$title 수정',
                  icon: const Icon(Icons.edit_rounded, size: 20),
                  color: const Color(0xFF6B7280),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            content.isEmpty ? '분석된 내용이 없습니다.' : content,
            style: TextStyle(
              fontSize: 14,
              height: 1.6,
              color: content.isEmpty
                  ? const Color(0xFF6B7280)
                  : const Color(0xFF374151),
            ),
          ),
        ],
      ),
    );

    if (onTapCard == null) return card;
    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTapCard,
        child: card,
      ),
    );
  }
}
