import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';
import '../utils/context_extensions.dart';

/// A cached remote image with a quiet placeholder and a fallback icon.
///
/// Cloudinary URLs are asked for at one of two sizes: [thumbnailWidth] for
/// every small picture (cards, cart, orders, groups) and [fullWidth] for the
/// product gallery. Two sizes, not one per screen, so an image seen on a card
/// is already cached when the cart shows it: a third size downloaded the
/// photo again and the cart sat blank meanwhile.
class AppNetworkImage extends StatelessWidget {
  const AppNetworkImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.displayWidth = thumbnailWidth,
    this.previewWidth,
    this.borderRadius = AppSpacing.radiusSm,
  });

  static const int thumbnailWidth = 400;
  static const int fullWidth = 900;

  final String url;
  final BoxFit fit;
  final int? displayWidth;

  /// A smaller copy shown while the full image loads; pass [thumbnailWidth]
  /// so the copy the product card already cached appears at once.
  final int? previewWidth;
  final double borderRadius;

  static const String _cloudinaryUpload = '/image/upload/';

  /// [url] as the CDN would serve it at [width] pixels wide; anything not on
  /// the CDN is returned as it is. The same address the widget loads, so a
  /// caller that needs the picture's size reads it from the same cache.
  static String sizedUrl(String url, int? width) {
    if (width == null || !url.contains(_cloudinaryUpload)) return url;
    return url.replaceFirst(_cloudinaryUpload, '${_cloudinaryUpload}f_auto,q_auto,w_$width/');
  }

  String _sized(int? width) => sizedUrl(url, width);

  @override
  Widget build(BuildContext context) {
    final placeholder = ColoredBox(color: context.colors.surfaceContainerHighest);
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: url.isEmpty
          ? _Fallback(background: placeholder)
          : CachedNetworkImage(
              imageUrl: _sized(displayWidth),
              fit: fit,
              fadeInDuration: previewWidth == null
                  ? const Duration(milliseconds: 300)
                  : Duration.zero,
              placeholder: (_, _) => previewWidth == null
                  ? placeholder
                  : CachedNetworkImage(
                      imageUrl: _sized(previewWidth),
                      fit: fit,
                      placeholder: (_, _) => placeholder,
                      errorWidget: (_, _, _) => placeholder,
                    ),
              errorWidget: (_, _, _) => _Fallback(background: placeholder),
            ),
    );
  }
}

class _Fallback extends StatelessWidget {
  const _Fallback({required this.background});

  final Widget background;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        background,
        Icon(Icons.cake_outlined, color: context.colors.onSurfaceVariant),
      ],
    );
  }
}
