import 'package:flutter/material.dart';

import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/widgets/summary_row.dart';
import '../../domain/entities/order.dart';
import 'order_section_card.dart';
import 'order_status_label.dart';

/// How it was paid. The method names the way chosen, never that money was
/// taken: an online payment still pending, or one that failed, must not
/// read "Paid online". The status line says where the money stands
/// ([OrderPaymentLabel.paymentLabel]).
class OrderPaymentCard extends StatelessWidget {
  const OrderPaymentCard({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return OrderSectionCard(
      title: OrderStrings.paymentSection,
      children: [
        SummaryRow(
          label: OrderStrings.paymentMethod,
          value: order.isCashOnDelivery ? OrderStrings.cashOnDelivery : OrderStrings.onlinePayment,
        ),
        SummaryRow(label: OrderStrings.paymentStatus, value: order.paymentLabel),
      ],
    );
  }
}
