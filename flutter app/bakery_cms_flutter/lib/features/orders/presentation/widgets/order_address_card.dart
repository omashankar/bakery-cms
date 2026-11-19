import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/order_address.dart';
import 'order_section_card.dart';

class OrderAddressCard extends StatelessWidget {
  const OrderAddressCard({super.key, required this.address});

  final OrderAddress address;

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant);
    return OrderSectionCard(
      title: OrderStrings.addressSection,
      children: [
        Text(address.fullName, style: context.text.bodyLarge),
        const SizedBox(height: AppSpacing.xs),
        Text(address.singleLine, style: muted),
        const SizedBox(height: AppSpacing.xs),
        Text(address.phone, style: muted),
      ],
    );
  }
}
