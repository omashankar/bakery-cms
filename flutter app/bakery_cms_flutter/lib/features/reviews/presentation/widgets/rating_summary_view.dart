import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/reviews_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/rating_summary.dart';
import '../../domain/entities/rating_tone.dart';
import '../../domain/services/rating_words.dart';
import 'rating_tone_colour.dart';

/// "4.1 ★ Very Good", "based on N ratings", a bar per star and the
/// customers' photos (the website's `RatingSummary`).
class RatingSummaryView extends StatelessWidget {
  const RatingSummaryView({super.key, required this.summary});

  /// The widest the bars run, as the website's `max-w-sm`.
  static const double barsMaxWidth = 384;
  static const double barHeight = AppSpacing.xs + AppSpacing.xxs;
  static const double starColumnWidth = AppSpacing.xxl;
  static const double countColumnWidth = AppSpacing.xxl;

  final RatingSummary summary;

  static String basedOn(int total) =>
      '${ReviewsStrings.basedOn} $total ${total == 1 ? ReviewsStrings.rating : ReviewsStrings.ratings}';

  @override
  Widget build(BuildContext context) {
    final tone = context.ratingColour(RatingTone.of(summary.average.round()));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text.rich(
              TextSpan(
                text: '${summary.average.toStringAsFixed(1)} ',
                children: [
                  TextSpan(
                    text: '★',
                    style: TextStyle(color: tone),
                  ),
                ],
              ),
              style: context.text.headlineSmall,
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                color: context.colors.tertiaryContainer,
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xxs,
                ),
                child: Text(
                  RatingWords.of(summary.average),
                  style: context.text.labelMedium?.copyWith(
                    color: context.colors.onTertiaryContainer,
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          basedOn(summary.total),
          style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.md),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: barsMaxWidth),
          child: Column(
            children: [
              for (final bar in summary.bars)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxs),
                  child: Row(
                    children: [
                      SizedBox(
                        width: starColumnWidth,
                        child: Text('${bar.stars} ★', style: context.text.labelSmall),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
                          child: LinearProgressIndicator(
                            value: bar.share / 100,
                            minHeight: barHeight,
                            color: context.ratingColour(RatingTone.of(bar.stars)),
                            backgroundColor: context.colors.surfaceContainerHighest,
                            semanticsLabel: '${bar.stars} ★',
                            semanticsValue: '${bar.count}',
                          ),
                        ),
                      ),
                      SizedBox(
                        width: countColumnWidth,
                        child: Text(
                          '${bar.count}',
                          textAlign: TextAlign.end,
                          style: context.text.labelSmall?.copyWith(
                            color: context.colors.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        if (summary.photos.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            height: AppSpacing.thumbnailSize,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: summary.photos.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (_, index) => SizedBox.square(
                dimension: AppSpacing.thumbnailSize,
                child: AppNetworkImage(url: summary.photos[index]),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
