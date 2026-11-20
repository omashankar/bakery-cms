import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../../core/constants/app_durations.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/home_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/home_banner.dart';
import '../../domain/services/home_catalog_index.dart';
import '../utils/link_opener.dart';
import '../utils/storefront_link.dart';

/// The slider at the top of the page: one picture at a time, turning by
/// itself, with dots under it.
class HeroCarousel extends StatefulWidget {
  const HeroCarousel({super.key, required this.slides, required this.index});

  /// Before the picture has loaded, the shape the website reserves (3:1).
  static const double reservedAspect = 3;

  /// Slides with words are cropped to this, as the website does on a phone.
  /// It is also the tallest an uncropped picture may be: height at most
  /// three quarters of the width, so a portrait upload cannot fill the page.
  static const double wordedAspect = 4 / 3;

  final List<HomeBanner> slides;
  final HomeCatalogIndex index;

  @override
  State<HeroCarousel> createState() => _HeroCarouselState();
}

class _HeroCarouselState extends State<HeroCarousel> {
  final PageController _pages = PageController();
  Timer? _timer;
  int _current = 0;

  /// The first picture's own width over height, once it has loaded.
  double? _measured;
  ImageStream? _stream;
  ImageStreamListener? _listener;

  /// Pictures with their words in the artwork: drawn whole at their own
  /// shape, never cropped (the website's uncropped hero).
  bool get _artwork => widget.slides.every((slide) => slide.title == null);

  double get _aspect => _artwork
      ? (_measured ?? HeroCarousel.reservedAspect).clamp(HeroCarousel.wordedAspect, double.infinity)
      : HeroCarousel.wordedAspect;

  @override
  void initState() {
    super.initState();
    if (widget.slides.length > 1) {
      _timer = Timer.periodic(AppDurations.heroSlide, (_) => _next());
    }
    if (_artwork) _measure();
  }

  /// Reads the first picture's size from the same address (and cache) the
  /// slide loads, so the band takes the artwork's own shape.
  void _measure() {
    final url = AppNetworkImage.sizedUrl(
      widget.slides.first.phoneImageUrl,
      AppNetworkImage.fullWidth,
    );
    final stream = CachedNetworkImageProvider(url).resolve(ImageConfiguration.empty);
    final listener = ImageStreamListener((info, _) {
      final ratio = info.image.width / info.image.height;
      if (mounted && ratio.isFinite && ratio > 0) setState(() => _measured = ratio);
      _forget();
    }, onError: (_, _) => _forget());
    _stream = stream..addListener(listener);
    _listener = listener;
  }

  void _forget() {
    final listener = _listener;
    if (listener != null) _stream?.removeListener(listener);
    _stream = null;
    _listener = null;
  }

  void _next() {
    if (!_pages.hasClients) return;
    final next = (_current + 1) % widget.slides.length;
    _pages.animateToPage(next, duration: AppDurations.slideTransition, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _forget();
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final slides = widget.slides;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: AspectRatio(
            aspectRatio: _aspect,
            child: PageView.builder(
              controller: _pages,
              itemCount: slides.length,
              onPageChanged: (page) => setState(() => _current = page),
              itemBuilder: (context, page) =>
                  _Slide(slide: slides[page], index: widget.index, whole: _artwork),
            ),
          ),
        ),
        if (slides.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < slides.length; i++)
                  Semantics(
                    label: '${HomeStrings.slideLabel} ${i + 1}',
                    selected: i == _current,
                    child: AnimatedContainer(
                      duration: AppDurations.slideTransition,
                      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xxs),
                      width: i == _current ? AppSpacing.lg : AppSpacing.sm,
                      height: AppSpacing.sm,
                      decoration: BoxDecoration(
                        color: i == _current ? context.colors.primary : context.colors.outline,
                        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Slide extends StatelessWidget {
  const _Slide({required this.slide, required this.index, required this.whole});

  final HomeBanner slide;
  final HomeCatalogIndex index;

  /// The whole picture, fitted; otherwise cropped to fill the box.
  final bool whole;

  @override
  Widget build(BuildContext context) {
    final worded = slide.title != null;
    // Without words the slide is finished artwork and the whole picture is
    // the link. With a headline the buttons carry the links instead, as on
    // the website (`hero-carousel.tsx`).
    final route = worded ? null : StorefrontLink.route(slide.href, index);
    return GestureDetector(
      onTap: route == null ? null : () => LinkOpener.open(context, route),
      child: Semantics(
        image: true,
        button: route != null,
        label: slide.imageAlt ?? slide.title,
        child: Stack(
          fit: StackFit.expand,
          children: [
            AppNetworkImage(
              url: slide.phoneImageUrl,
              fit: whole ? BoxFit.contain : BoxFit.cover,
              displayWidth: AppNetworkImage.fullWidth,
              borderRadius: AppSpacing.radiusLg,
            ),
            // Words only when the shop typed them; a hero is often artwork with
            // its words in the picture, and drawing them twice reads as a bug.
            if (worded) _SlideWords(slide: slide, index: index),
          ],
        ),
      ),
    );
  }
}

/// A worded slide's copy, as the website lays it over the picture: a scrim
/// on the side the words are on, then the badge, the headline, the line
/// under it, and the buttons.
class _SlideWords extends StatelessWidget {
  const _SlideWords({required this.slide, required this.index});

  /// The website's `from-black/70 via-black/40 to-transparent`.
  static const double _scrimStrong = 0.7;
  static const double _scrimMid = 0.4;

  /// The words keep to the left part of the slide, as the website's
  /// `max-w-xl` column does over a wide picture.
  static const double _copyWidthFactor = 0.8;

  final HomeBanner slide;
  final HomeCatalogIndex index;

  @override
  Widget build(BuildContext context) {
    final onPhoto = context.colors.onPrimary;
    final scrim = context.colors.scrim;
    final badge = slide.badge;
    final subtitle = slide.subtitle;
    final primaryLabel = slide.ctaLabel;
    final primary = StorefrontLink.route(slide.href, index);
    final secondaryLabel = slide.secondaryCtaLabel;
    final secondary = slide.hasSecondaryCta
        ? StorefrontLink.route(slide.secondaryHref, index)
        : null;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              scrim.withValues(alpha: _scrimStrong),
              scrim.withValues(alpha: _scrimMid),
              scrim.withValues(alpha: 0),
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Align(
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: _copyWidthFactor,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (badge != null) ...[
                    _SlideBadge(label: badge),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                  Text(
                    slide.title!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.titleLarge?.copyWith(color: onPhoto),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.bodySmall?.copyWith(color: onPhoto),
                    ),
                  ],
                  if (primaryLabel != null || secondary != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        if (primaryLabel != null)
                          FilledButton.icon(
                            onPressed: primary == null
                                ? null
                                : () => LinkOpener.open(context, primary),
                            icon: const Icon(Icons.arrow_forward, size: AppSpacing.iconSm),
                            iconAlignment: IconAlignment.end,
                            label: Text(primaryLabel),
                          ),
                        if (secondaryLabel != null && secondary != null)
                          OutlinedButton(
                            onPressed: () => LinkOpener.open(context, secondary),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: onPhoto,
                              side: BorderSide(color: onPhoto, width: AppSpacing.borderWidth),
                            ),
                            child: Text(secondaryLabel),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The small chip above a worded slide's headline (the website's accent
/// badge with a sparkle).
class _SlideBadge extends StatelessWidget {
  const _SlideBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.secondaryContainer,
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.auto_awesome, size: AppSpacing.iconSm, color: colors.onSecondaryContainer),
            const SizedBox(width: AppSpacing.xs),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.text.labelMedium?.copyWith(color: colors.onSecondaryContainer),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
