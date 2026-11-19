import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../../wishlist/presentation/widgets/wishlist_heart_button.dart';

/// Swipeable product photos, edge to edge, with page dots and the wishlist
/// heart in the top corner. The page index is view state only, so it lives
/// here rather than in the cubit.
class ProductGallery extends StatefulWidget {
  const ProductGallery({super.key, required this.images, required this.productSlug});

  final List<String> images;

  /// What the heart saves.
  final String productSlug;

  @override
  State<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends State<ProductGallery> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final images = widget.images.isEmpty ? const [''] : widget.images;
    return AspectRatio(
      aspectRatio: AppSpacing.productCardImageAspect,
      child: Stack(
        children: [
          PageView.builder(
            itemCount: images.length,
            onPageChanged: (page) => setState(() => _page = page),
            itemBuilder: (_, index) => AppNetworkImage(
              url: images[index],
              displayWidth: AppNetworkImage.fullWidth,
              previewWidth: AppNetworkImage.thumbnailWidth,
              borderRadius: 0,
            ),
          ),
          Positioned(
            top: AppSpacing.xs,
            right: AppSpacing.xs,
            child: WishlistHeartButton(productSlug: widget.productSlug),
          ),
          if (images.length > 1)
            Positioned(
              left: 0,
              right: 0,
              bottom: AppSpacing.md,
              child: Center(
                child: _PageDots(count: images.length, current: _page),
              ),
            ),
        ],
      ),
    );
  }
}

/// The dots sit on a soft pill of the page colour, so they read on a dark
/// photo and a white one alike. The current one is drawn longer.
class _PageDots extends StatelessWidget {
  const _PageDots({required this.count, required this.current});

  static const double dotSize = 6;
  static const double currentDotWidth = 16;

  /// How much of the photo shows through the pill behind the dots.
  static const double groundAlpha = 0.8;
  static const Duration turn = Duration(milliseconds: 200);

  final int count;
  final int current;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surface.withValues(alpha: groundAlpha),
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < count; i++)
              AnimatedContainer(
                duration: turn,
                width: i == current ? currentDotWidth : dotSize,
                height: dotSize,
                margin: const EdgeInsets.symmetric(horizontal: AppSpacing.xxs),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
                  color: i == current ? context.colors.primary : context.colors.onSurfaceVariant,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
