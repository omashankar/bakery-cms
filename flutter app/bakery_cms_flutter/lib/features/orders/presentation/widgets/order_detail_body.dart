import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/date_formatter.dart';
import '../../domain/entities/order_details.dart';
import '../../domain/entities/order_status.dart';
import 'cancel_order_button.dart';
import 'order_address_card.dart';
import 'order_closed_banner.dart';
import 'order_delivery_card.dart';
import 'order_gift_card.dart';
import 'email_invoice_button.dart';
import 'order_line_tile.dart';
import 'order_payment_card.dart';
import 'order_policy_card.dart';
import 'order_section_card.dart';
import 'order_status_tracker.dart';
import 'order_totals_card.dart';

/// Everything about one order, top to bottom.
class OrderDetailBody extends StatelessWidget {
  const OrderDetailBody({super.key, required this.details});

  final OrderDetails details;

  @override
  Widget build(BuildContext context) {
    final order = details.order;
    final closedEarly =
        order.status == OrderStatus.cancelled || order.status == OrderStatus.refunded;
    const gap = SizedBox(height: AppSpacing.lg);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          OrderStrings.placedOn(DateFormatter.timestamp(order.placedAt)),
          style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
        ),
        gap,
        if (closedEarly) OrderClosedBanner(order: order) else OrderStatusTracker(order: order),
        gap,
        OrderSectionCard(
          title: OrderStrings.itemsSection,
          children: [for (final line in order.items) OrderLineTile(line: line)],
        ),
        gap,
        OrderDeliveryCard(order: order),
        gap,
        OrderAddressCard(address: order.address),
        gap,
        OrderPaymentCard(order: order),
        gap,
        OrderTotalsCard(totals: order.totals, couponCode: order.couponCode),
        gap,
        OrderPolicyCard(order: order),
        if (order.gift case final gift? when gift.hasNote) ...[gap, OrderGiftCard(gift: gift)],
        if (order.orderNotes != null) ...[
          gap,
          OrderSectionCard(
            title: OrderStrings.notesSection,
            children: [Text(order.orderNotes!, style: context.text.bodyMedium)],
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        const EmailInvoiceButton(),
        if (details.canCancel) ...[
          const SizedBox(height: AppSpacing.xl),
          const CancelOrderButton(),
        ],
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }
}
