import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/offers_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../domain/services/coupon_rules.dart';
import '../bloc/offers_cubit.dart';
import '../bloc/offers_state.dart';

/// "Available offers" on the product page, as the website says them: the
/// free-delivery threshold, then each live code with its minimum. Nothing at
/// all when the shop is running no offers — not an empty heading.
///
/// Reads [OffersCubit] from above.
class ProductOffers extends StatelessWidget {
  const ProductOffers({
    super.key,
    required this.freeDeliveryThreshold,
    required this.currency,
    this.frame,
  });

  final double freeDeliveryThreshold;
  final String currency;

  /// What the block is drawn inside (the page's section band), drawn only
  /// when there are offers to say.
  final Widget Function(Widget block)? frame;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<OffersCubit, OffersState>(
      builder: (context, state) {
        final lines = CouponRules.productPageLines(
          coupons: state.coupons,
          freeDeliveryThreshold: freeDeliveryThreshold,
          money: (amount) => MoneyFormatter.format(amount, currency: currency),
          now: DateTime.now(),
        );
        if (lines.isEmpty) return const SizedBox.shrink();
        final accent = context.colors.primary;
        final block = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.percent, size: AppSpacing.iconSm, color: accent),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  OffersStrings.availableOffers,
                  style: context.text.titleSmall?.copyWith(color: accent),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            for (final line in lines)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('•', style: context.text.bodyMedium?.copyWith(color: accent)),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(child: Text(line, style: context.text.bodyMedium)),
                  ],
                ),
              ),
          ],
        );
        return frame?.call(block) ?? block;
      },
    );
  }
}
