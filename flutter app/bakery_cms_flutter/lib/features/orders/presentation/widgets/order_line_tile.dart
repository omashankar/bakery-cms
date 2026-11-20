import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../../../core/widgets/app_network_image.dart';
import '../../domain/entities/order_line.dart';

class OrderLineTile extends StatelessWidget {
  const OrderLineTile({super.key, required this.line});

  final OrderLine line;

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox.square(
            dimension: AppSpacing.thumbnailSize,
            child: AppNetworkImage(url: line.image),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(line.name, style: context.text.bodyLarge),
                if (line.choices.isNotEmpty) Text(line.choices.join(' · '), style: muted),
                if (line.message != null)
                  Text('${OrderStrings.messageOnCake}: ${line.message}', style: muted),
                Text(OrderStrings.quantity(line.quantity), style: muted),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(MoneyFormatter.format(line.lineTotal), style: context.text.bodyLarge),
        ],
      ),
    );
  }
}
