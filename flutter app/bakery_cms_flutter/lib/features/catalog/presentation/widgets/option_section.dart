import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/catalog_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/choice_chips.dart';

/// "Weight" with its chips; the same block for flavour, shape and each
/// variant group. The page spaces the blocks, so it has no margin of its own.
class OptionSection<T> extends StatelessWidget {
  const OptionSection({
    super.key,
    required this.title,
    required this.options,
    required this.selected,
    required this.labelOf,
    required this.onSelected,
    this.isRequired = false,
  });

  final String title;
  final List<T> options;
  final T? selected;
  final String Function(T option) labelOf;
  final ValueChanged<T> onSelected;
  final bool isRequired;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(title, style: context.text.titleSmall),
            if (isRequired && selected == null)
              Text(
                CatalogStrings.required,
                style: context.text.labelSmall?.copyWith(color: context.colors.error),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        ChoiceChips<T>(
          options: options,
          selected: selected,
          labelOf: labelOf,
          onSelected: onSelected,
        ),
      ],
    );
  }
}
