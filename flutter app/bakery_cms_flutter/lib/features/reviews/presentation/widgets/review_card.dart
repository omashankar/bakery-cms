import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/reviews_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/product_review.dart';
import '../../domain/entities/rating_tone.dart';
import '../../domain/services/rating_words.dart';
import '../utils/relative_time.dart';
import 'rating_tone_colour.dart';

/// One review in the sideways row: the score and the reviewer's heading (or
/// the word for the score), when, the text, their photos, the shop's reply,
/// who wrote it, and 👍 / 👎 (the website's review card).
class ReviewCard extends StatelessWidget {
  const ReviewCard({
    super.key,
    required this.review,
    required this.helpfulCount,
    required this.unhelpfulCount,
    required this.votedUp,
    required this.votedDown,
    required this.onHelpful,
    required this.onUnhelpful,
  });

  /// The size of a reviewer's photo on the card.
  static const double photoSize = AppSpacing.xxxl + AppSpacing.sm;

  final ProductReview review;
  final int helpfulCount;
  final int unhelpfulCount;
  final bool votedUp;
  final bool votedDown;
  final VoidCallback onHelpful;
  final VoidCallback onUnhelpful;

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    final date = review.date;
    final reply = review.adminReply;
    final city = review.deliveredCity;
    final voted = votedUp || votedDown;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _ScoreChip(rating: review.rating),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    review.title ?? RatingWords.of(review.rating),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.titleSmall,
                  ),
                ),
                if (date != null) Text(RelativeTime.of(date), style: muted),
              ],
            ),
            if (review.isFeatured) ...[
              const SizedBox(height: AppSpacing.sm),
              Chip(
                label: const Text(ReviewsStrings.featured),
                visualDensity: VisualDensity.compact,
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                backgroundColor: context.colors.secondaryContainer,
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Text(review.body, style: context.text.bodyMedium),
            if (review.photoUrls.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final url in review.photoUrls)
                    SizedBox.square(
                      dimension: photoSize,
                      child: AppNetworkImage(url: url),
                    ),
                ],
              ),
            ],
            if (reply != null) ...[
              const SizedBox(height: AppSpacing.md),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: context.colors.surface,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(ReviewsStrings.shopResponse, style: context.text.labelMedium),
                      const SizedBox(height: AppSpacing.xs),
                      Text(reply, style: muted),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        review.author,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.text.labelMedium,
                      ),
                      if (city != null)
                        Row(
                          children: [
                            Icon(
                              Icons.verified_outlined,
                              size: AppSpacing.iconSm,
                              color: context.colors.tertiary,
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Flexible(
                              child: Text(
                                '${ReviewsStrings.verifiedBuyer}, $city',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: muted,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
                _Thumb(
                  icon: votedUp ? Icons.thumb_up : Icons.thumb_up_outlined,
                  label: votedUp ? ReviewsStrings.markedHelpful : ReviewsStrings.helpful,
                  count: helpfulCount,
                  lit: votedUp ? context.colors.tertiary : null,
                  onPressed: voted ? null : onHelpful,
                ),
                _Thumb(
                  icon: votedDown ? Icons.thumb_down : Icons.thumb_down_outlined,
                  label: votedDown ? ReviewsStrings.markedNotHelpful : ReviewsStrings.notHelpful,
                  count: unhelpfulCount,
                  lit: votedDown ? context.colors.error : null,
                  onPressed: voted ? null : onUnhelpful,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ScoreChip extends StatelessWidget {
  const _ScoreChip({required this.rating});

  final double rating;

  @override
  Widget build(BuildContext context) {
    final score = rating == rating.roundToDouble() ? '${rating.round()}' : '$rating';
    return Semantics(
      label: '$score ${ReviewsStrings.ratedOutOf}',
      excludeSemantics: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppSpacing.xs),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: AppSpacing.xxs),
          child: Text.rich(
            TextSpan(
              text: score,
              children: [
                TextSpan(
                  text: '★',
                  style: TextStyle(color: context.ratingColour(RatingTone.of(rating.round()))),
                ),
              ],
            ),
            style: context.text.labelMedium,
          ),
        ),
      ),
    );
  }
}

/// 👍 or 👎 with its count; a count shows only once somebody pressed it.
class _Thumb extends StatelessWidget {
  const _Thumb({
    required this.icon,
    required this.label,
    required this.count,
    required this.lit,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final int count;
  final Color? lit;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colour = lit ?? context.colors.onSurfaceVariant;
    return Semantics(
      button: true,
      label: label,
      selected: lit != null,
      excludeSemantics: true,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          foregroundColor: colour,
          disabledForegroundColor: colour,
          visualDensity: VisualDensity.compact,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          minimumSize: Size.zero,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: AppSpacing.iconSm),
            if (count > 0) ...[const SizedBox(width: AppSpacing.xs), Text('$count')],
          ],
        ),
      ),
    );
  }
}
