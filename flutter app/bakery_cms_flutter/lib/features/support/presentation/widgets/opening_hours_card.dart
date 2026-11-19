import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_card.dart';
import '../../domain/entities/opening_hours.dart';

/// "Opening Hours". The caller draws it only when the shop publishes some:
/// a heading over nothing would be its own small lie (the website's rule).
class OpeningHoursCard extends StatelessWidget {
  const OpeningHoursCard({super.key, required this.hours});

  final List<OpeningHours> hours;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(SupportStrings.openingHours, style: context.text.titleMedium),
          const SizedBox(height: AppSpacing.md),
          for (final row in hours)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  Icon(Icons.schedule, size: AppSpacing.iconSm, color: context.colors.primary),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: Text(row.day, style: context.text.bodyMedium)),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    row.hours,
                    style: context.text.bodyMedium?.copyWith(
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
