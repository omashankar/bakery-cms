import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/date_formatter.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/order_status.dart';
import 'order_status_label.dart';

/// The order's progress along [OrderStatus.journey], with the time each
/// reached step was recorded.
class OrderStatusTracker extends StatelessWidget {
  const OrderStatusTracker({super.key, required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final current = OrderStatus.journey.indexOf(order.status);
    return Column(
      children: [
        for (var index = 0; index < OrderStatus.journey.length; index++)
          _TrackerStep(
            status: OrderStatus.journey[index],
            reached: index <= current,
            isLast: index == OrderStatus.journey.length - 1,
            at: _timeOf(OrderStatus.journey[index]),
          ),
      ],
    );
  }

  String? _timeOf(OrderStatus status) {
    for (final event in order.statusHistory) {
      if (event.status == status) return DateFormatter.timestamp(event.at);
    }
    return status == OrderStatus.pending ? DateFormatter.timestamp(order.placedAt) : null;
  }
}

class _TrackerStep extends StatelessWidget {
  const _TrackerStep({
    required this.status,
    required this.reached,
    required this.isLast,
    required this.at,
  });

  final OrderStatus status;
  final bool reached;
  final bool isLast;
  final String? at;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = reached ? colors.primary : colors.outline;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Icon(
                reached ? Icons.check_circle : Icons.radio_button_unchecked,
                color: color,
                size: AppSpacing.iconMd,
              ),
              if (!isLast)
                Expanded(
                  child: VerticalDivider(color: color, width: AppSpacing.iconMd),
                ),
            ],
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    status.label,
                    style: context.text.bodyLarge?.copyWith(
                      color: reached ? colors.onSurface : colors.onSurfaceVariant,
                    ),
                  ),
                  if (reached && at != null)
                    Text(
                      at!,
                      style: context.text.bodySmall?.copyWith(color: colors.onSurfaceVariant),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
