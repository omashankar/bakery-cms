import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';

/// One block of the product page: a thin muted band above it, so the page
/// reads as a stack of cards rather than one long form, then an optional
/// heading and the block's own content.
class ProductSection extends StatelessWidget {
  const ProductSection({super.key, required this.child, this.title, this.padded = true});

  final Widget child;
  final String? title;

  /// False for a block that runs edge to edge (a horizontal row of products)
  /// and pads itself.
  final bool padded;

  @override
  Widget build(BuildContext context) {
    final heading = title;
    final inset = padded ? AppSpacing.lg : 0.0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: AppSpacing.sm,
          child: ColoredBox(color: context.colors.surfaceContainerHighest),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(inset, AppSpacing.lg, inset, AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (heading != null) ...[
                // Always in line with the page's other headings, even over a
                // block that runs edge to edge.
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: AppSpacing.lg - inset),
                  child: Text(heading, style: context.text.titleMedium),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              child,
            ],
          ),
        ),
      ],
    );
  }
}
