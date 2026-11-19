import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/order_status.dart';
import 'order_status_label.dart';

class OrderStatusChip extends StatelessWidget {
  const OrderStatusChip({super.key, required this.status});

  final OrderStatus status;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (background, foreground) = switch (status) {
      OrderStatus.cancelled ||
      OrderStatus.refunded => (colors.errorContainer, colors.onErrorContainer),
      OrderStatus.delivered => (colors.tertiary, colors.onTertiary),
      _ => (colors.surfaceContainerHighest, colors.onSurface),
    };
    return DecoratedBox(
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppSpacing.radiusPill),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
        child: Text(status.label, style: context.text.labelMedium?.copyWith(color: foreground)),
      ),
    );
  }
}
