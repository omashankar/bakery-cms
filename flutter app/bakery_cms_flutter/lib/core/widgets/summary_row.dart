import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';
import '../utils/context_extensions.dart';

/// "Label ........ value", for price breakdowns and order details.
class SummaryRow extends StatelessWidget {
  const SummaryRow({
    super.key,
    required this.label,
    required this.value,
    this.emphasised = false,
    this.valueColor,
  });

  final String label;
  final String value;
  final bool emphasised;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final style = emphasised ? context.text.titleMedium : context.text.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: Text(label, style: style)),
          const SizedBox(width: AppSpacing.md),
          Text(value, style: style?.copyWith(color: valueColor)),
        ],
      ),
    );
  }
}
