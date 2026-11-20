import 'package:equatable/equatable.dart';

/// One picture in a hero slider or a banner band.
class HomeBanner extends Equatable {
  const HomeBanner({
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

  final String imageUrl;

  /// A picture composed for a phone, when the shop added one.
  final String? mobileImageUrl;
  final String? title;
  final String? subtitle;
  final String? ctaLabel;
  final String? href;

  /// What the picture shows, for a screen reader.
  final String? imageAlt;

  /// Width over height of the box the website draws it in at phone width.
  final double? aspectRatio;

  /// Columns of a two-column phone grid it takes: 1 or 2.
  final int span;

  /// A hero slide's small chip above the headline. Sent only with a headline.
  final String? badge;

  /// A hero slide's second button. Both are sent, or neither, and only with
  /// a headline (`storefront-home.ts` `heroOf`).
  final String? secondaryCtaLabel;
  final String? secondaryHref;

  /// The second button, when the shop set both its words and its link.
  bool get hasSecondaryCta => secondaryCtaLabel != null && secondaryHref != null;

  /// What a phone should draw.
  String get phoneImageUrl => mobileImageUrl ?? imageUrl;

  bool get isFullWidth => span >= 2;

  @override
  List<Object?> get props => [
    imageUrl,
    mobileImageUrl,
    title,
    subtitle,
    ctaLabel,
    href,
    imageAlt,
    aspectRatio,
    span,
    badge,
    secondaryCtaLabel,
    secondaryHref,
  ];
}
