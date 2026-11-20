import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';
import '../constants/app_strings.dart';
import '../utils/context_extensions.dart';
import '../utils/money_formatter.dart';

/// A price, with the struck-through "was" price beside it when there is one.
class PriceText extends StatelessWidget {
  const PriceText({
    super.key,
    required this.amount,
    this.compareAt,
    this.currency = 'INR',
    this.style,
    this.showPercentOff = false,
  });

  final num amount;
  final num? compareAt;
  final String currency;
  final TextStyle? style;

  /// "20% OFF" beside a discount, as the website's cards show it.
  final bool showPercentOff;

  @override
  Widget build(BuildContext context) {
    final main = style ?? context.text.titleMedium;
    final was = compareAt;
    final showCompare = was != null && was > amount;
    return Wrap(
      spacing: AppSpacing.sm,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(MoneyFormatter.format(amount, currency: currency), style: main),
        if (showCompare)
          Text(
            MoneyFormatter.format(was, currency: currency),
            style: context.text.bodySmall?.copyWith(
              color: context.colors.onSurfaceVariant,
              decoration: TextDecoration.lineThrough,
            ),
          ),
        if (showCompare && showPercentOff)
          Text(
            '${((was - amount) / was * 100).round()}${AppStrings.percentOffSuffix}',
            style: context.text.labelSmall?.copyWith(color: context.colors.tertiary),
          ),
      ],
    );
  }
}
