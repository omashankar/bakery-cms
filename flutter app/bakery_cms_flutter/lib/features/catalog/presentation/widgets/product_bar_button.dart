import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/widgets/app_button_variant.dart';

/// A button in the product page's bottom bar. Unlike `AppButton` its label is
/// one line that shrinks to fit, with narrow side padding: at 320dp and large
/// text, two buttons and the heart share the row, and a label that wrapped
/// would make the bar grow or overflow.
class ProductBarButton extends StatelessWidget {
  const ProductBarButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
  });

  const ProductBarButton.secondary({super.key, required this.label, required this.onPressed})
    : variant = AppButtonVariant.secondary;

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;

  static const EdgeInsets _padding = EdgeInsets.symmetric(horizontal: AppSpacing.sm);

  @override
  Widget build(BuildContext context) {
    final child = FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(label, maxLines: 1, softWrap: false),
    );
    final button = switch (variant) {
      AppButtonVariant.secondary => OutlinedButton(
        style: OutlinedButton.styleFrom(padding: _padding),
        onPressed: onPressed,
        child: child,
      ),
      AppButtonVariant.text => TextButton(
        style: TextButton.styleFrom(padding: _padding),
        onPressed: onPressed,
        child: child,
      ),
      AppButtonVariant.primary => FilledButton(
        style: FilledButton.styleFrom(padding: _padding),
        onPressed: onPressed,
        child: child,
      ),
    };
    return SizedBox(width: double.infinity, child: button);
  }
}
