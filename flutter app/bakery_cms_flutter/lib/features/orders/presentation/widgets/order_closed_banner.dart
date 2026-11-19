import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/order_status.dart';

/// Shown in place of the tracker for a cancelled or refunded order.
class OrderClosedBanner extends StatelessWidget {
  const OrderClosedBanner({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final title = order.status == OrderStatus.refunded
        ? OrderStrings.refundedBanner
        : OrderStrings.cancelledBanner;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.errorContainer,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.info_outline, color: colors.onErrorContainer),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: context.text.titleSmall?.copyWith(color: colors.onErrorContainer),
                  ),
                  if (order.cancellationReason != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      order.cancellationReason!,
                      style: context.text.bodyMedium?.copyWith(color: colors.onErrorContainer),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
