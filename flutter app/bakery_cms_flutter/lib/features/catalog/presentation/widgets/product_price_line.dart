import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/product_page_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../store/presentation/widgets/shop_currency.dart';

/// The product page's price: the price of what is chosen now, large; the
/// struck "was" price and "34% off" beside it; and under them the honest tax
/// line. The shop adds GST at checkout, so it never says "inclusive".
class ProductPriceLine extends StatelessWidget {
  const ProductPriceLine({super.key, required this.amount, this.compareAt});

  final double amount;
  final double? compareAt;

  /// Whole percent off, or null when there is no real discount to show.
  static int? percentOff(double amount, double? compareAt) {
    final was = compareAt;
    if (was == null || was <= amount || was <= 0) return null;
    final percent = ((was - amount) / was * 100).round();
    return percent > 0 ? percent : null;
  }

  @override
  Widget build(BuildContext context) {
    final currency = context.shopCurrency;
    final was = compareAt;
    final percent = percentOff(amount, was);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xxs,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              MoneyFormatter.format(amount, currency: currency),
              style: context.text.headlineSmall,
            ),
            if (percent != null && was != null) ...[
              Text(
                MoneyFormatter.format(was, currency: currency),
                style: context.text.bodyLarge?.copyWith(
                  color: context.colors.onSurfaceVariant,
                  decoration: TextDecoration.lineThrough,
                ),
              ),
              Text(
                '$percent${ProductPageStrings.percentOffSuffix}',
                style: context.text.titleSmall?.copyWith(color: context.colors.tertiary),
              ),
            ],
          ],
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          ProductPageStrings.taxNote,
          style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
        ),
      ],
    );
  }
}
