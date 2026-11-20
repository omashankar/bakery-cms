import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/listing_strings.dart';
import '../../../../core/utils/context_extensions.dart';

/// "4.6 ★ (14)": the rating on a filled chip and the number of reviews beside
/// it, on a small pill made to sit over a product photo. Draws nothing for a
/// product nobody has reviewed: "0 ★" reads as a bad product, not a new one.
class RatingBadge extends StatelessWidget {
  const RatingBadge({super.key, required this.rating, required this.reviewCount});

  final double rating;
  final int reviewCount;

  @override
  Widget build(BuildContext context) {
    if (reviewCount <= 0) return const SizedBox.shrink();
    final small = context.text.labelSmall;
    final value = rating.toStringAsFixed(1);
    return Semantics(
      label: ListingStrings.ratingSemantics(value, reviewCount),
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
        ),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xxs),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: context.colors.tertiary,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xs,
                    vertical: AppSpacing.xxs,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(value, style: small?.copyWith(color: context.colors.onTertiary)),
                      const SizedBox(width: AppSpacing.xxs),
                      Icon(Icons.star, size: small?.fontSize, color: context.colors.onTertiary),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                child: Text(
                  '${ListingStrings.reviewsOpen}$reviewCount${ListingStrings.reviewsClose}',
                  style: small?.copyWith(color: context.colors.onSurfaceVariant),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
