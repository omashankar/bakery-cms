import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/date_formatter.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/order.dart';
import 'order_status_chip.dart';

class OrderListTile extends StatelessWidget {
  const OrderListTile({super.key, required this.order, required this.onTap});

  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final firstImage = order.items.isEmpty ? '' : order.items.first.image;
    final names = order.items.map((line) => line.name).join(', ');
    return AppCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox.square(
            dimension: AppSpacing.thumbnailSize,
            child: AppNetworkImage(url: firstImage),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        order.orderNumber,
                        style: context.text.titleSmall,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    OrderStatusChip(status: order.status),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  names,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.text.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${OrderStrings.placedOn(DateFormatter.timestamp(order.placedAt))} · '
                  '${OrderStrings.itemCount(order.totals.itemCount)}',
                  style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(MoneyFormatter.format(order.totals.total), style: context.text.titleSmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
