import 'package:flutter/material.dart';

import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/order_gift.dart';
import 'order_section_card.dart';

/// The customer's own copy of what they asked for: the occasion and the
/// message for the recipient. The sender is not repeated, as on the
/// website's order page: the person reading it is the one who sent it.
class OrderGiftCard extends StatelessWidget {
  const OrderGiftCard({super.key, required this.gift});

  final OrderGift gift;

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant);
    return OrderSectionCard(
      title: OrderStrings.personalisationSection,
      children: [
        if (gift.occasion != null) Text(OrderStrings.occasion(gift.occasion!), style: muted),
        if (gift.message != null) Text(OrderStrings.quoted(gift.message!), style: muted),
      ],
    );
  }
}
