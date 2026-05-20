import 'package:flutter/material.dart';

class NoticePage extends StatelessWidget {
  const NoticePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('공지사항', style: TextStyle(color: Color(0xFF3E2723))),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF3E2723)),
      ),
      backgroundColor: Colors.white,
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          _buildNoticeItem(
            '부엉 스피치 정식 런칭 안내', 
            '2026.03.20', 
            '안녕하세요. 부엉 스피치입니다.\n\n여러분의 면접 준비를 도와줄 AI 면접 서비스가 새롭게 출시되었습니다. 실제 면접과 유사한 환경에서 연습하고, 디테일한 피드백을 받아보세요.\n\n감사합니다.'
          ),
          const Divider(height: 32, color: Color(0xFFF3F4F6)),
          _buildNoticeItem(
            '서버 점검에 따른 서비스 일시중지 안내', 
            '2026.03.15', 
            '안정적인 서비스 제공을 위해 새벽 2시부터 4시까지 정기 서버 점검이 진행될 예정입니다. 이용에 불편을 드려 죄송합니다.'
          ),
        ],
      ),
    );
  }

  Widget _buildNoticeItem(String title, String date, String content) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF111827))),
        const SizedBox(height: 6),
        Text(date, style: const TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
        const SizedBox(height: 16),
        Text(content, style: const TextStyle(fontSize: 14, color: Color(0xFF4B5563), height: 1.6)),
      ],
    );
  }
}
