import 'package:flutter/material.dart';

import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/date_formatter.dart';
import '../../../../core/widgets/summary_row.dart';
import '../../domain/entities/order.dart';
import 'order_section_card.dart';

class OrderDeliveryCard extends StatelessWidget {
  const OrderDeliveryCard({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final date = order.deliveryDate == null ? null : DateFormatter.fromApiDate(order.deliveryDate!);
    return OrderSectionCard(
      title: OrderStrings.deliverySection,
      children: [
        if (date != null)
          SummaryRow(label: OrderStrings.deliveryDate, value: DateFormatter.day(date)),
        if (order.deliveryTimeSlot != null)
          SummaryRow(label: OrderStrings.deliverySlot, value: order.deliveryTimeSlot!),
        if (order.deliveryTierLabel != null)
          SummaryRow(label: OrderStrings.deliverySpeed, value: order.deliveryTierLabel!),
        if (date == null && order.estimatedDelivery.isNotEmpty)
          SummaryRow(
            label: OrderStrings.estimatedDelivery,
            value: DateFormatter.timestamp(order.estimatedDelivery),
          ),
      ],
    );
  }
}
