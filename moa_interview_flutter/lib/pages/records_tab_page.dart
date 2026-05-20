import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../config/admob_config.dart';
import '../services/auth_service.dart';
import '../services/interview_record_db.dart';
import '../utils/interview_score_display.dart';
import 'interview_record_detail_page.dart';
import 'records_aggregate_score_page.dart';

/// 하단 '기록' 탭 — 로컬 SQLite 목록만 표시 (웹/서버와 무관)
class RecordsTabPage extends StatefulWidget {
  const RecordsTabPage({super.key});

  @override
  RecordsTabPageState createState() => RecordsTabPageState();
}

class _RecordsTabData {
  const _RecordsTabData({required this.sessions, required this.subScoreAvgs});

  final List<InterviewSessionRow> sessions;
  final Map<String, double> subScoreAvgs;

  static const empty = _RecordsTabData(sessions: [], subScoreAvgs: <String, double>{});
}

class RecordsTabPageState extends State<RecordsTabPage> {
  final _auth = AuthService.instance;
  Future<_RecordsTabData>? _future;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  /// 핫 리로드 시 `_future` 필드 타입이 바뀐 뒤에도 예전 [Future]가 남아 런타임 타입 오류가 나는 것을 방지
  @override
  void reassemble() {
    super.reassemble();
    _reload();
  }

  Future<_RecordsTabData> _loadRecordsBundle() async {
    final uid = _auth.currentUser?.id;
    final db = InterviewRecordDb.instance;
    final sessions = await db.listSessions(userId: uid);
    final subScoreAvgs = await db.averageSubScoresFromEvaluations(userId: uid);
    return _RecordsTabData(sessions: sessions, subScoreAvgs: subScoreAvgs);
  }

  Future<void> _reload() async {
    final Future<_RecordsTabData> f = _loadRecordsBundle();
    setState(() => _future = f);
    await f;
  }

  /// [HomePage]에서 기록 탭 선택 시 최신 세션 반영
  void refresh() => _reload();

  String _formatDate(int ms) {
    final d = DateTime.fromMillisecondsSinceEpoch(ms);
    return '${d.year}.${d.month.toString().padLeft(2, '0')}.${d.day.toString().padLeft(2, '0')}';
  }

  /// 저장된 세션들의 [avg_score] 산술 평균 (점수 없는 세션은 제외)
  double? _overallAverageScore(List<InterviewSessionRow> rows) {
    final scores = rows.where((r) => r.avgScore != null).map((r) => r.avgScore!).toList();
    if (scores.isEmpty) return null;
    return scores.reduce((a, b) => a + b) / scores.length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFDFBF7),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: const Color(0xFFFDFBF7),
        foregroundColor: const Color(0xFF5D4037),
        title: const Text(
          '면접 기록',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        centerTitle: true,
      ),
      body: FutureBuilder<_RecordsTabData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: Color(0xFF8D6E63)));
          }
          if (snap.hasError) {
            return Center(child: Text('불러오기 실패: ${snap.error}'));
          }
          final bundle = snap.data ?? _RecordsTabData.empty;
          final rows = bundle.sessions;
          final subScoreAvgs = bundle.subScoreAvgs;
          final overallAvg = _overallAverageScore(rows);
          final latestMs = rows.isNotEmpty ? rows.first.createdAtMs : null;

          return RefreshIndicator(
            color: const Color(0xFFF59E0B),
            onRefresh: _reload,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                    child: _OwlReportDashboard(
                      overallAvg: overallAvg,
                      sessionCount: rows.length,
                      latestDateLabel: latestMs != null ? _formatDate(latestMs) : null,
                      subScoreAvgs: subScoreAvgs,
                    ),
                  ),
                ),
                if (rows.isEmpty)
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Opacity(
                            opacity: 0.9,
                            child: Image.asset(
                              'assets/images/owl_character.png',
                              height: 120,
                              fit: BoxFit.contain,
                            ),
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            '아직 저장된 면접 기록이 없어요 부엉!\n첫 면접 연습을 시작해볼까요?',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF8D6E63),
                              height: 1.5,
                            ),
                          ),
                          const SizedBox(height: 80), // To perfectly center visually
                        ],
                      ),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, i) {
                          // 인덱스 1: 첫 번째 기록 다음에 배너 광고 삽입
                          if (i == 1) {
                            return const Padding(
                              padding: EdgeInsets.only(bottom: 16),
                              child: _RecordsBannerAd(),
                            );
                          }

                          // 광고 슬롯(index 1) 이후는 rows 인덱스를 한 칸씩 당김
                          final rowIndex = i > 1 ? i - 1 : i;
                          final r = rows[rowIndex];
                          final isLast = rowIndex == rows.length - 1;
                          return Padding(
                            padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
                            child: _InterviewRecordCard(
                              row: r,
                              scoreText: formatAiScoreFraction(r.avgScore),
                              qPreview: r.firstQuestion.length > 72
                                  ? '${r.firstQuestion.substring(0, 72)}…'
                                  : r.firstQuestion,
                              dateLabel: _formatDate(r.createdAtMs),
                              onOpen: () async {
                                await Navigator.of(context).push<void>(
                                  MaterialPageRoute<void>(
                                    builder: (_) => InterviewRecordDetailPage(sessionId: r.id),
                                  ),
                                );
                                if (mounted) _reload();
                              },
                            ),
                          );
                        },
                        // 기록이 1개 이상일 때만 광고 슬롯(+1) 추가
                        childCount: rows.length >= 1 ? rows.length + 1 : rows.length,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// 말풍선·부엉 스프라이트·점수 색을 **동일한 점수 구간**으로 맞춤 (null / 8+ / 6+ / 그 미만)
class _OwlReportTone {
  _OwlReportTone({
    required this.speechText,
    required this.assetPath,
    required this.scoreColor,
  });

  final String speechText;
  final String assetPath;
  final Color scoreColor;

  static const String kDefaultOwlAsset = 'assets/images/owl_character.png';

  factory _OwlReportTone.fromAvg(double? overallAvg) {
    if (overallAvg == null) {
      return _OwlReportTone(
        speechText: '면접 연습을 시작해볼까요?',
        assetPath: kDefaultOwlAsset,
        scoreColor: const Color(0xFFE65100),
      );
    }
    final v = overallAvg;
    final tierStyle = InterviewTierStyle.forTier(tierFromAverage(v));
    if (v >= 8.0) {
      return _OwlReportTone(
        speechText: '최고예요! 합격이 눈앞에 보여요 부엉!',
        assetPath: 'assets/images/owl_happy.png',
        scoreColor: tierStyle.accent,
      );
    }
    if (v >= 6.0) {
      return _OwlReportTone(
        speechText: '점점 좋아지고 있어요! 화이팅!',
        assetPath: 'assets/images/owl_cheering.png',
        scoreColor: tierStyle.accent,
      );
    }
    return _OwlReportTone(
      speechText: '우리 함께 더 연습해봐요 부엉!',
      assetPath: 'assets/images/owl_sad.png',
      scoreColor: tierStyle.accent,
    );
  }
}

/// [assetPath] 로드 실패 시 기본 부엉만 표시 (누락 PNG로 캐릭터가 안 바뀌는 것처럼 보이는 문제 완화)
class _OwlMoodImage extends StatelessWidget {
  const _OwlMoodImage({required this.assetPath});

  final String assetPath;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      assetPath,
      key: ValueKey<String>(assetPath),
      height: 90,
      fit: BoxFit.contain,
      gaplessPlayback: false,
      errorBuilder: (context, error, stackTrace) {
        return Image.asset(
          _OwlReportTone.kDefaultOwlAsset,
          key: const ValueKey<String>('owl_fallback'),
          height: 90,
          fit: BoxFit.contain,
        );
      },
    );
  }
}

/// 부엉이 캐릭터가 포함된 새로운 대시보드 형태의 요약 위젯
class _OwlReportDashboard extends StatelessWidget {
  const _OwlReportDashboard({
    required this.overallAvg,
    required this.sessionCount,
    required this.latestDateLabel,
    required this.subScoreAvgs,
  });

  final double? overallAvg;
  final int sessionCount;
  final String? latestDateLabel;
  final Map<String, double> subScoreAvgs;

  @override
  Widget build(BuildContext context) {
    final avgText = overallAvg != null ? formatAiScoreFraction(overallAvg) : '—';
    final tone = _OwlReportTone.fromAvg(overallAvg);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.4)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD54F).withValues(alpha: 0.15),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          // 상단 캐릭터 및 멘트 영역
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFFFFF8E1), Color(0xFFFFECB3)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            padding: const EdgeInsets.fromLTRB(20, 24, 16, 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.95),
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(14),
                            topRight: Radius.circular(14),
                            bottomRight: Radius.circular(14),
                            bottomLeft: Radius.circular(4),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.05),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Text(
                          tone.speechText,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFE65100),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        '나의 면접 리포트',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF4E342E),
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                _OwlMoodImage(assetPath: tone.assetPath),
              ],
            ),
          ),
          // 하단 통계 수치 영역
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 8),
            child: Row(
              children: [
                Expanded(
                  child: _SummaryCell(
                    icon: Icons.analytics_rounded,
                    iconBgColor: const Color(0xFFFFF3E0),
                    iconColor: const Color(0xFFFB8C00),
                    label: '총 평균 점수',
                    value: avgText,
                    valueColor: tone.scoreColor,
                    showRightDivider: true,
                    showTrailingChevron: true,
                    onTap: () {
                      Navigator.of(context).push<void>(
                        MaterialPageRoute<void>(
                          builder: (_) => RecordsAggregateScorePage(
                            overallAvg: overallAvg,
                            subScoreAvgs: subScoreAvgs,
                          ),
                        ),
                      );
                    },
                  ),
                ),
                Expanded(
                  child: _SummaryCell(
                    icon: Icons.assignment_rounded,
                    iconBgColor: const Color(0xFFEFEBE9),
                    iconColor: const Color(0xFF8D6E63),
                    label: '면접 기록',
                    value: sessionCount > 0 ? '$sessionCount회' : '0회',
                    valueColor: const Color(0xFF4E342E),
                    showRightDivider: true,
                  ),
                ),
                Expanded(
                  child: _SummaryCell(
                    icon: Icons.calendar_today_rounded,
                    iconBgColor: const Color(0xFFEFEBE9),
                    iconColor: const Color(0xFF8D6E63),
                    label: '최근 기록',
                    value: latestDateLabel ?? '—',
                    valueColor: const Color(0xFF4E342E),
                    showRightDivider: false,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryCell extends StatelessWidget {
  const _SummaryCell({
    required this.icon,
    required this.iconBgColor,
    required this.iconColor,
    required this.label,
    required this.value,
    required this.valueColor,
    required this.showRightDivider,
    this.onTap,
    this.showTrailingChevron = false,
  });

  final IconData icon;
  final Color iconBgColor;
  final Color iconColor;
  final String label;
  final String value;
  final Color valueColor;
  final bool showRightDivider;
  final VoidCallback? onTap;
  final bool showTrailingChevron;

  @override
  Widget build(BuildContext context) {
    final column = Column(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: iconBgColor,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 20, color: iconColor),
        ),
        const SizedBox(height: 10),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Color(0xFF8D6E63),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w900,
            color: valueColor,
          ),
        ),
      ],
    );

    // chevron은 Stack으로 오른쪽에 겹쳐 두어, 본문 Column이 칸 **전체 너비** 기준으로 가운데 오게 함 (Row+Expanded는 왼쪽으로 밀림)
    final inner = showTrailingChevron
        ? Stack(
            clipBehavior: Clip.none,
            children: [
              Center(child: column),
              Positioned(
                right: 0,
                top: 0,
                bottom: 0,
                child: Center(
                  child: Icon(
                    Icons.chevron_right_rounded,
                    size: 24,
                    color: const Color(0xFFBCAAA4),
                  ),
                ),
              ),
            ],
          )
        : column;

    final bordered = DecoratedBox(
      decoration: BoxDecoration(
        border: showRightDivider
            ? const Border(
                right: BorderSide(color: Color(0xFFF3F4F6), width: 1.5),
              )
            : null,
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        child: inner,
      ),
    );

    if (onTap == null) {
      return bordered;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        splashColor: const Color(0xFFF59E0B).withValues(alpha: 0.12),
        highlightColor: const Color(0xFFF59E0B).withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        child: bordered,
      ),
    );
  }
}

class _InterviewRecordCard extends StatelessWidget {
  const _InterviewRecordCard({
    required this.row,
    required this.scoreText,
    required this.qPreview,
    required this.dateLabel,
    required this.onOpen,
  });

  final InterviewSessionRow row;
  final String scoreText;
  final String qPreview;
  final String dateLabel;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onOpen,
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFF3F4F6)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // 점수 뱃지를 좀 더 강조하고 귀엽게 변경
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED), // 부드러운 오렌지 배경
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFFEDD5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.star_rounded, color: Color(0xFFF59E0B), size: 16),
                        const SizedBox(width: 4),
                        Text(
                          scoreText,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                            color: Color(0xFFC2410C),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9FAFB),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.calendar_month_rounded, size: 14, color: Color(0xFF9CA3AF)),
                        const SizedBox(width: 4),
                        Text(
                          dateLabel,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF6B7280),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // 직무/회사 정보
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: const BoxDecoration(
                      color: Color(0xFFEFEBE9),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.business_center_rounded, size: 14, color: Color(0xFF5D4037)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${row.companyName} · ${row.jobTitle}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF4E342E),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFFEDD5)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Text(
                          '결과 보기',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFFC2410C),
                          ),
                        ),
                        SizedBox(width: 2),
                        Icon(Icons.chevron_right_rounded, size: 14, color: Color(0xFFC2410C)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              // 질문 프리뷰
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFFDFBF7),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFEFEBE9)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: const [
                        Icon(Icons.format_quote_rounded, size: 16, color: Color(0xFFD7CCC8)),
                        SizedBox(width: 4),
                        Text(
                          '첫 번째 질문',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF8D6E63),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      qPreview,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        height: 1.5,
                        color: Color(0xFF4B5563),
                        fontWeight: FontWeight.w500,
                      ),
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
}

/// 기록 탭 커스텀 네이티브 광고 위젯.
/// 첫 번째 기록 다음에 삽입되며, 로드 실패 시 공간을 차지하지 않습니다.
class _RecordsBannerAd extends StatefulWidget {
  const _RecordsBannerAd();

  @override
  State<_RecordsBannerAd> createState() => _RecordsBannerAdState();
}

class _RecordsBannerAdState extends State<_RecordsBannerAd> {
  NativeAd? _nativeAd;
  bool _isLoaded = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb && AdmobConfig.supportedPlatform) {
      _loadAd();
    }
  }

  void _loadAd() {
    final ad = NativeAd(
      adUnitId: AdmobConfig.recordNativeUnitId,
      factoryId: 'recordAd',
      request: const AdRequest(),
      listener: NativeAdListener(
        onAdLoaded: (ad) {
          if (!mounted) {
            ad.dispose();
            return;
          }
          setState(() {
            _nativeAd = ad as NativeAd;
            _isLoaded = true;
          });
        },
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
          debugPrint('[RecordsNativeAd] 로드 실패: $error');
        },
      ),
    );
    ad.load();
  }

  @override
  void dispose() {
    _nativeAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isLoaded || _nativeAd == null) return const SizedBox.shrink();
    return SizedBox(
      height: 68,
      child: AdWidget(ad: _nativeAd!),
    );
  }
}
