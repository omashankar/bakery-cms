import 'package:flutter/material.dart';

import '../../../../core/utils/context_extensions.dart';

/// A small label over a group of choices, or a note under one.
class FieldCaption extends StatelessWidget {
  const FieldCaption(this.text, {super.key, this.isError = false, this.muted = false});

  final String text;
  final bool isError;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final color = isError
        ? context.colors.error
        : (muted ? context.colors.onSurfaceVariant : context.colors.onSurface);
    final style = muted || isError ? context.text.bodySmall : context.text.labelLarge;
    return Text(text, style: style?.copyWith(color: color));
  }
}
