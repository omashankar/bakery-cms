import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';
import '../constants/app_strings.dart';
import '../utils/context_extensions.dart';

/// A section title with an optional "View all".
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.onViewAll,
    this.actionLabel = AppStrings.viewAll,
  });

  final String title;
  final VoidCallback? onViewAll;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      // Tight: the "View all" button already makes the row 48dp tall, and
      // with more above it the home screen read as gaps between sections.
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.xs,
      ),
      child: Row(
        children: [
          Expanded(child: Text(title, style: context.text.titleMedium)),
          if (onViewAll != null) TextButton(onPressed: onViewAll, child: Text(actionLabel)),
        ],
      ),
    );
  }
}
