import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';

/// A single-choice row of chips: weights, flavours, delivery tiers, slots.
class ChoiceChips<T> extends StatelessWidget {
  const ChoiceChips({
    super.key,
    required this.options,
    required this.selected,
    required this.labelOf,
    required this.onSelected,
    this.isEnabled,
  });

  final List<T> options;
  final T? selected;
  final String Function(T option) labelOf;
  final ValueChanged<T> onSelected;
  final bool Function(T option)? isEnabled;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (final option in options)
          ChoiceChip(
            label: Text(labelOf(option)),
            selected: option == selected,
            onSelected: (isEnabled?.call(option) ?? true) ? (_) => onSelected(option) : null,
          ),
      ],
    );
  }
}
