import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';

/// Account rows that belong together, in one rounded card with a hairline
/// between them, under an optional [title]: the way a shopping app lays out
/// its account screen, rather than one long loose list.
class AccountTileGroup extends StatelessWidget {
  const AccountTileGroup({super.key, required this.children, this.title});

  final String? title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final heading = title;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (heading != null)
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.xs, bottom: AppSpacing.sm),
            child: Semantics(
              header: true,
              child: Text(
                heading,
                style: context.text.titleSmall?.copyWith(color: colors.onSurfaceVariant),
              ),
            ),
          ),
        DecoratedBox(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(color: colors.outlineVariant),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            child: Column(
              children: [
                for (var i = 0; i < children.length; i++) ...[
                  if (i > 0)
                    Divider(
                      height: AppSpacing.borderWidth,
                      indent: AppSpacing.xxxl + AppSpacing.sm, // where the row's text starts
                      color: colors.outlineVariant,
                    ),
                  children[i],
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}
