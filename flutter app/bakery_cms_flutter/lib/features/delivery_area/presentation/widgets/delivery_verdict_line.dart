import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/delivery_area_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../domain/entities/delivery_area.dart';
import '../../domain/entities/delivery_verdict.dart';

/// The shop's answer about a PIN code, in words: yes (with the charge), parts
/// of it, or no.
class DeliveryVerdictLine extends StatelessWidget {
  const DeliveryVerdictLine({super.key, required this.area, required this.currency});

  final DeliveryArea area;

  /// The shop's currency code, for the delivery charge.
  final String currency;

  @override
  Widget build(BuildContext context) {
    final yes = area.verdict == DeliveryVerdict.eligible;
    final color = switch (area.verdict) {
      DeliveryVerdict.eligible => context.colors.tertiary,
      DeliveryVerdict.partly => context.colors.onSurfaceVariant,
      DeliveryVerdict.outside || DeliveryVerdict.unknown => context.colors.error,
    };
    final headline = switch (area.verdict) {
      DeliveryVerdict.eligible => DeliveryAreaStrings.eligibleHeadline,
      DeliveryVerdict.partly => DeliveryAreaStrings.partlyHeadline,
      DeliveryVerdict.outside => DeliveryAreaStrings.outsideHeadline,
      DeliveryVerdict.unknown => DeliveryAreaStrings.unknownHeadline,
    };
    final details = [
      if (yes) ?_chargeLine(),
      if (yes && area.priceMayVary) DeliveryAreaStrings.priceMayVary,
      if (area.verdict == DeliveryVerdict.partly) DeliveryAreaStrings.partlyMessage,
      if (area.verdict == DeliveryVerdict.unknown) DeliveryAreaStrings.unknownMessage,
    ];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          yes ? Icons.check_circle_outline : Icons.info_outline,
          color: color,
          size: AppSpacing.iconMd,
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(headline, style: context.text.bodyMedium?.copyWith(color: color)),
              for (final line in details)
                Text(
                  line,
                  style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                ),
            ],
          ),
        ),
      ],
    );
  }

  /// "Delivery ₹99 · Free above ₹999", or "Free delivery".
  String? _chargeLine() {
    final charge = area.charge;
    if (charge == null) return null;
    if (charge == 0) return DeliveryAreaStrings.freeDelivery;
    final threshold = area.freeDeliveryThreshold;
    final price = MoneyFormatter.format(charge, currency: currency);
    if (threshold == null || threshold <= 0) return '${DeliveryAreaStrings.deliveryCharge} $price';
    return '${DeliveryAreaStrings.deliveryCharge} $price${DeliveryAreaStrings.placeSeparator}'
        '${DeliveryAreaStrings.freeAbove} ${MoneyFormatter.format(threshold, currency: currency)}';
  }
}
