import 'package:flutter/material.dart';

import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/summary_row.dart';
import '../../../orders/domain/entities/order_totals.dart';

/// The shop's totals, line by line. Zero lines are left out.
class PriceBreakdown extends StatelessWidget {
  const PriceBreakdown({super.key, required this.totals, required this.currency});

  final OrderTotals totals;
  final String currency;

  String _money(double amount) => MoneyFormatter.format(amount, currency: currency);

  @override
  Widget build(BuildContext context) {
    final t = totals;
    return Column(
      children: [
        SummaryRow(label: CheckoutStrings.subtotal, value: _money(t.subtotal)),
        SummaryRow(
          label: CheckoutStrings.deliveryFee,
          value: t.delivery > 0 ? _money(t.delivery) : CheckoutStrings.free,
        ),
        if (t.deliveryTierFee > 0)
          SummaryRow(
            label: t.deliveryTierLabel ?? CheckoutStrings.speedFee,
            value: _money(t.deliveryTierFee),
          ),
        if (t.giftWrapFee > 0)
          SummaryRow(label: CheckoutStrings.giftWrapFee, value: _money(t.giftWrapFee)),
        if (t.platformCharge > 0)
          SummaryRow(label: CheckoutStrings.platformFee, value: _money(t.platformCharge)),
        if (t.tax > 0) SummaryRow(label: t.taxLabel ?? CheckoutStrings.tax, value: _money(t.tax)),
        if (t.discount > 0)
          SummaryRow(
            label: CheckoutStrings.discount,
            value: '${CheckoutStrings.minus}${_money(t.discount)}',
            valueColor: Theme.of(context).colorScheme.tertiary,
          ),
        const Divider(),
        SummaryRow(label: CheckoutStrings.total, value: _money(t.total), emphasised: true),
      ],
    );
  }
}
