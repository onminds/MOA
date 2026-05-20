import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';

import '../config/admob_config.dart';

/// 앱 테마에 맞는 네이티브 광고 카드 위젯.
///
/// - 로딩 중: 베이지 카드 + 스피너
/// - 로딩 완료: 베이지 카드 안에 AdWidget 중앙 배치
/// - 로딩 실패 또는 미지원 플랫폼: SizedBox.shrink() (공간 차지 안 함)
/// - [onLoaded]: 광고 로딩 성공·실패 모두에서 호출됨 (캐러셀 타이머 등 연동용)
/// - [height]: 카드 전체 높이. null 이면 내부 ad(90px) 높이에 맞춰짐
class NativeAdCard extends StatefulWidget {
  const NativeAdCard({super.key, this.onLoaded, this.height, this.adUnitId, this.decoration, this.adBackgroundColor});

  final VoidCallback? onLoaded;
  final double? height;

  /// 광고 단위 ID. null 이면 [AdmobConfig.nativeUnitId] 사용.
  final String? adUnitId;

  /// 카드 외부 decoration. null 이면 기본 베이지 배경 사용.
  final BoxDecoration? decoration;

  /// 광고 템플릿 내부 배경색. null 이면 흰색 사용.
  final Color? adBackgroundColor;

  @override
  State<NativeAdCard> createState() => _NativeAdCardState();
}

class _NativeAdCardState extends State<NativeAdCard> {
  NativeAd? _nativeAd;
  bool _isLoaded = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb && AdmobConfig.supportedPlatform) {
      _loadAd();
    } else {
      _failed = true;
    }
  }

  void _loadAd() {
    final ad = NativeAd(
      adUnitId: widget.adUnitId ?? AdmobConfig.nativeUnitId,
      request: const AdRequest(),
      listener: NativeAdListener(
        onAdLoaded: (Ad ad) {
          if (!mounted) {
            ad.dispose();
            return;
          }
          setState(() {
            _nativeAd = ad as NativeAd;
            _isLoaded = true;
          });
          widget.onLoaded?.call();
        },
        onAdFailedToLoad: (Ad ad, LoadAdError error) {
          ad.dispose();
          debugPrint('[NativeAdCard] 로드 실패: $error');
          if (mounted) setState(() => _failed = true);
          widget.onLoaded?.call();
        },
      ),
      nativeTemplateStyle: NativeTemplateStyle(
        templateType: TemplateType.small,
        mainBackgroundColor: widget.adBackgroundColor ?? Colors.white,
        cornerRadius: widget.adBackgroundColor != null ? 24 : 16,
        callToActionTextStyle: NativeTemplateTextStyle(
          textColor: Colors.white,
          backgroundColor: const Color(0xFF5D4037),
          style: NativeTemplateFontStyle.bold,
          size: 13.0,
        ),
        primaryTextStyle: NativeTemplateTextStyle(
          textColor: const Color(0xFF2F3542),
          style: NativeTemplateFontStyle.bold,
          size: 14.0,
        ),
        secondaryTextStyle: NativeTemplateTextStyle(
          textColor: const Color(0xFF8D6E63),
          style: NativeTemplateFontStyle.normal,
          size: 12.0,
        ),
        tertiaryTextStyle: NativeTemplateTextStyle(
          textColor: const Color(0xFFBCAAA4),
          style: NativeTemplateFontStyle.normal,
          size: 11.0,
        ),
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
    if (_failed) return const SizedBox.shrink();

    // decoration이 빈 BoxDecoration()이면 카드 없이 AdWidget만 표시
    final isNaked = widget.decoration != null &&
        widget.decoration!.color == null &&
        widget.decoration!.gradient == null &&
        widget.decoration!.border == null;

    if (!_isLoaded || _nativeAd == null) {
      // 로딩 중: naked 모드이면 투명하게, 아니면 카드+스피너
      if (isNaked) return SizedBox(height: widget.height ?? 90);
      return SizedBox(
        height: widget.height,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFFFAF8F5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFEDE0D4)),
          ),
          clipBehavior: Clip.antiAlias,
          child: const SizedBox(
            height: 90,
            child: Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Color(0xFFBCAAA4),
                ),
              ),
            ),
          ),
        ),
      );
    }

    final adWidget = SizedBox(
      height: 90,
      child: AdWidget(ad: _nativeAd!),
    );

    if (isNaked) {
      return SizedBox(height: widget.height, child: Center(child: adWidget));
    }

    return SizedBox(
      height: widget.height,
      child: Container(
        decoration: widget.decoration ??
            BoxDecoration(
              color: const Color(0xFFFAF8F5),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFEDE0D4)),
            ),
        clipBehavior: Clip.antiAlias,
        child: Center(child: adWidget),
      ),
    );
  }
}
