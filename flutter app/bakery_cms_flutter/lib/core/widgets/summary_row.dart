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

  /// The most of the row the value may take before it wraps.
  static const double _valueMaxShare = 0.6;

  @override
  Widget build(BuildContext context) {
    final style = emphasised ? context.text.titleMedium : context.text.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      // The value keeps to its share and wraps, right-aligned, past it: a
      // long one (a date and a window, a big amount at a large text size)
      // ran off the screen's edge.
      child: LayoutBuilder(
        builder: (context, constraints) => Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(label, style: style)),
            const SizedBox(width: AppSpacing.md),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: constraints.maxWidth * _valueMaxShare),
              child: Text(
                value,
                textAlign: TextAlign.end,
                style: style?.copyWith(color: valueColor),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
