import 'package:flutter/material.dart';

import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/date_formatter.dart';
import '../../../../core/widgets/summary_row.dart';
import '../../domain/entities/order.dart';
import 'cancellation_class_text.dart';
import 'order_section_card.dart';
import 'order_status_label.dart';

/// "Cancellation & refund", as the website's order page has it: the rule this
/// order was placed under (its own copy, not today's wording), when the
/// terms were agreed, and the refund's own state, "Processed" only once the
/// payment provider said so.
class OrderPolicyCard extends StatelessWidget {
  const OrderPolicyCard({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final accepted = order.termsAcceptedAt;
    final refund = order.refund?.state.label;
    return OrderSectionCard(
      title: OrderStrings.cancellationSection,
      children: [
        SummaryRow(label: OrderStrings.policy, value: order.policyClass.customerText),
        if (accepted != null)
          Text(
            OrderStrings.agreedOn(DateFormatter.timestamp(accepted)),
            style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
          ),
        if (refund != null) SummaryRow(label: OrderStrings.refund, value: refund),
      ],
    );
  }
}
