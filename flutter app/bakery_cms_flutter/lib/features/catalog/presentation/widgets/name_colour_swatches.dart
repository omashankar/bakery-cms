import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/services/photo_print_layout.dart';

/// The lettering colours, as round swatches; the chosen one is ringed.
class NameColourSwatches extends StatelessWidget {
  const NameColourSwatches({super.key, required this.selected, required this.onSelected});

  /// ARGB.
  final int selected;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (final colour in PhotoPrintLayout.nameColours)
          Semantics(
            button: true,
            selected: colour == selected,
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => onSelected(colour),
              child: Container(
                width: AppSpacing.xxl,
                height: AppSpacing.xxl,
                decoration: BoxDecoration(
                  // The print's own ink, not a theme colour.
                  color: Color(colour),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: colour == selected ? context.colors.primary : context.colors.outline,
                    width: colour == selected ? AppSpacing.xxs * 1.5 : AppSpacing.borderWidth,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
