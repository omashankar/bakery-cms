import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/home_promise.dart';

/// The shop's promises side by side: an icon, a line, a smaller line.
class PromisesStrip extends StatelessWidget {
  const PromisesStrip({super.key, required this.items});

  final List<HomePromise> items;

  static IconData _iconFor(String kind) => switch (kind) {
    'rating' => Icons.star_rounded,
    'free-delivery' => Icons.local_shipping_outlined,
    'delivery' || 'same-day' => Icons.schedule_outlined,
    'fresh' => Icons.cake_outlined,
    'secure' || 'payments' => Icons.verified_user_outlined,
    _ => Icons.verified_outlined,
  };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final item in items)
            Expanded(
              child: Column(
                children: [
                  Icon(_iconFor(item.kind), color: context.colors.primary),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    item.title,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: context.text.labelMedium,
                  ),
                  if (item.subtitle case final subtitle?)
                    Text(
                      subtitle,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: context.text.labelSmall?.copyWith(
                        color: context.colors.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
