import 'package:flutter/material.dart';

import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/summary_row.dart';
import '../../domain/entities/order_totals.dart';
import 'order_section_card.dart';

/// The shop's own price breakdown. Rows that are zero are left out.
class OrderTotalsCard extends StatelessWidget {
  const OrderTotalsCard({super.key, required this.totals, this.couponCode});

  final OrderTotals totals;
  final String? couponCode;

  @override
  Widget build(BuildContext context) {
    String money(num amount) => MoneyFormatter.format(amount);
    return OrderSectionCard(
      title: OrderStrings.summarySection,
      children: [
        SummaryRow(label: OrderStrings.subtotal, value: money(totals.subtotal)),
        SummaryRow(
          label: OrderStrings.delivery,
          value: totals.delivery == 0 ? OrderStrings.freeDelivery : money(totals.delivery),
        ),
        if (totals.deliveryTierFee > 0)
          SummaryRow(
            label: totals.deliveryTierLabel ?? OrderStrings.deliverySpeedFee,
            value: money(totals.deliveryTierFee),
          ),
        if (totals.giftWrapFee > 0)
          SummaryRow(label: OrderStrings.giftWrap, value: money(totals.giftWrapFee)),
        if (totals.platformCharge > 0)
          SummaryRow(label: OrderStrings.platformCharge, value: money(totals.platformCharge)),
        if (totals.tax > 0)
          SummaryRow(label: totals.taxLabel ?? OrderStrings.tax, value: money(totals.tax)),
        if (totals.discount > 0)
          SummaryRow(
            label: couponCode == null
                ? OrderStrings.discount
                : OrderStrings.couponDiscount(couponCode!),
            value: '− ${money(totals.discount)}',
          ),
        const Divider(),
        SummaryRow(label: OrderStrings.total, value: money(totals.total), emphasised: true),
      ],
    );
  }
}
