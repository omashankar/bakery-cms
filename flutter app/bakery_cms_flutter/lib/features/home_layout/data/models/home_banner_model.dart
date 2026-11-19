import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/image_url.dart';
import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/home_banner.dart';

part 'home_banner_model.g.dart';

@JsonSerializable(createToJson: false)
class HomeBannerModel {
  const HomeBannerModel({
    required this.imageUrl,
    this.mobileImageUrl,
    this.title,
    this.subtitle,
    this.ctaLabel,
    this.href,
    this.imageAlt,
    this.aspectRatio,
    this.span = 1,
    this.badge,
    this.secondaryCtaLabel,
    this.secondaryHref,
  });

  factory HomeBannerModel.fromJson(Map<String, dynamic> json) => _$HomeBannerModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String imageUrl;
  final String? mobileImageUrl;
  final String? title;
  final String? subtitle;
  final String? ctaLabel;
  final String? href;
  final String? imageAlt;
  @JsonKey(fromJson: JsonReaders.toDoubleOrNull)
  final double? aspectRatio;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int span;

  /// Hero slides only (`StorefrontHomeHeroSlide`): null on a banner.
  final String? badge;
  final String? secondaryCtaLabel;
  final String? secondaryHref;

  /// Null for a banner with no picture: there is nothing to draw.
  HomeBanner? toEntity() {
    if (imageUrl.trim().isEmpty) return null;
    final mobile = _text(mobileImageUrl);
    final ratio = aspectRatio;
    final secondLabel = _text(secondaryCtaLabel);
    final secondHref = _text(secondaryHref);
    return HomeBanner(
      imageUrl: ImageUrl.resolve(imageUrl),
      mobileImageUrl: mobile == null ? null : ImageUrl.resolve(mobile),
      title: _text(title),
      subtitle: _text(subtitle),
      ctaLabel: _text(ctaLabel),
      href: _text(href),
      imageAlt: _text(imageAlt),
      // A box with no height or no width cannot be drawn; leave it to the band.
      aspectRatio: ratio != null && ratio > 0 && ratio.isFinite ? ratio : null,
      span: span >= 2 ? 2 : 1,
      badge: _text(badge),
      // A button needs both its words and its link, as on the website.
      secondaryCtaLabel: secondLabel != null && secondHref != null ? secondLabel : null,
      secondaryHref: secondLabel != null && secondHref != null ? secondHref : null,
    );
  }

  static String? _text(String? value) =>
      (value == null || value.trim().isEmpty) ? null : value.trim();
}
