import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';
import 'app_button_variant.dart';

/// The app's one button. [isLoading] shows a spinner and disables it, so a
/// double tap can never send a request twice.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.isLoading = false,
    this.icon,
    this.expand = true,
  });

  const AppButton.secondary({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.icon,
    this.expand = true,
  }) : variant = AppButtonVariant.secondary;

  const AppButton.text({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.icon,
    this.expand = false,
  }) : variant = AppButtonVariant.text;

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final bool isLoading;
  final IconData? icon;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final action = isLoading ? null : onPressed;
    final child = _ButtonContent(label: label, icon: icon, isLoading: isLoading);
    final button = switch (variant) {
      AppButtonVariant.primary => FilledButton(onPressed: action, child: child),
      AppButtonVariant.secondary => OutlinedButton(onPressed: action, child: child),
      AppButtonVariant.text => TextButton(onPressed: action, child: child),
    };
    return expand ? SizedBox(width: double.infinity, child: button) : button;
  }
}

class _ButtonContent extends StatelessWidget {
  const _ButtonContent({required this.label, required this.icon, required this.isLoading});

  final String label;
  final IconData? icon;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const SizedBox.square(
        dimension: AppSpacing.iconMd - AppSpacing.xs,
        child: CircularProgressIndicator(strokeWidth: AppSpacing.loaderStroke),
      );
    }
    if (icon == null) return Text(label);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: AppSpacing.iconSm + AppSpacing.xxs),
        const SizedBox(width: AppSpacing.sm),
        Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}
