import 'package:flutter/material.dart';

import '../../../../core/widgets/choice_chips.dart';

/// [ChoiceChips] in one sideways-scrolling row, for long lists like dates.
class HorizontalChoices<T> extends StatelessWidget {
  const HorizontalChoices({
    super.key,
    required this.options,
    required this.selected,
    required this.labelOf,
    required this.onSelected,
  });

  final List<T> options;
  final T? selected;
  final String Function(T option) labelOf;
  final ValueChanged<T> onSelected;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: ChoiceChips<T>(
        options: options,
        selected: selected,
        labelOf: labelOf,
        onSelected: onSelected,
      ),
    );
  }
}
