import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/widgets/choice_chips.dart';
import '../../../catalog/domain/entities/product.dart';
import 'home_product_row.dart';

/// One heading, several tabs, and the products of the chosen tab.
class TabsBand extends StatefulWidget {
  const TabsBand({super.key, required this.tabs});

  /// Each tab's label and products, already resolved and none of them empty.
  final List<({String label, List<Product> products})> tabs;

  @override
  State<TabsBand> createState() => _TabsBandState();
}

class _TabsBandState extends State<TabsBand> {
  int _selected = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = widget.tabs;
    final selected = _selected.clamp(0, tabs.length - 1);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (tabs.length > 1)
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.sm),
            child: ChoiceChips<int>(
              options: [for (var i = 0; i < tabs.length; i++) i],
              selected: selected,
              labelOf: (i) => tabs[i].label,
              onSelected: (i) => setState(() => _selected = i),
            ),
          ),
        HomeProductRow(
          // A new row per tab, so the list starts at its first card.
          key: ValueKey(selected),
          products: tabs[selected].products,
        ),
      ],
    );
  }
}
