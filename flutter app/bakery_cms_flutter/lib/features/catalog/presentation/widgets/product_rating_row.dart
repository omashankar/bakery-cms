import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/product_page_strings.dart';
import '../../../../core/utils/context_extensions.dart';

/// "4.6 ★" in a small filled badge, then "Rating & 14 Reviews". The page
/// draws it only when the product has a review.
class ProductRatingRow extends StatelessWidget {
  const ProductRatingRow({super.key, required this.rating, required this.count});

  final double rating;
  final int count;

  static String countLabel(int count) =>
      '${ProductPageStrings.ratingAnd} $count '
      '${count == 1 ? ProductPageStrings.review : ProductPageStrings.reviews}';

  @override
  Widget build(BuildContext context) {
    final onBadge = context.colors.onTertiary;
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: context.colors.tertiary,
            borderRadius: BorderRadius.circular(AppSpacing.radiusSm / 2),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xs + AppSpacing.xxs,
              vertical: AppSpacing.xxs,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  rating.toStringAsFixed(1),
                  style: context.text.labelMedium?.copyWith(color: onBadge),
                ),
                const SizedBox(width: AppSpacing.xxs),
                Icon(Icons.star_rounded, size: AppSpacing.iconSm - AppSpacing.xxs, color: onBadge),
              ],
            ),
          ),
        ),
        Text(
          countLabel(count),
          style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
        ),
      ],
    );
  }
}
