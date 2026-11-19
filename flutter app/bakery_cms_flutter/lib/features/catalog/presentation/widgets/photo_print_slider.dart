import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../domain/entities/photo_print_range.dart';

/// One labelled slider in the photo print editor (the website's `Adjust`).
class PhotoPrintSlider extends StatelessWidget {
  const PhotoPrintSlider({
    super.key,
    required this.label,
    required this.value,
    required this.range,
    required this.onChanged,
  });

  /// Room for the longest label ("Left / right") beside the slider.
  static const double labelWidth = 88;

  final String label;
  final double value;
  final PhotoPrintRange range;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: labelWidth,
          child: Text(
            label,
            style: context.text.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Slider(
            value: range.clamp(value),
            min: range.min,
            max: range.max,
            divisions: range.divisions,
            label: label,
            onChanged: onChanged,
          ),
        ),
      ],
    );
  }
}
