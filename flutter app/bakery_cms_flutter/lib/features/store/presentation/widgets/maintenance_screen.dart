import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/store_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';

/// What a customer sees while the shop is closed: the website's
/// `MaintenanceScreen`, which REPLACES the storefront and the account rather
/// than sitting above them, so nobody can browse, add to the cart or check
/// out a shop its owner closed.
///
/// No navigation, as on the website: every link would lead back into the
/// closed shop. [onCheckAgain] re-reads the shop's settings instead.
class MaintenanceScreen extends StatelessWidget {
  const MaintenanceScreen({
    super.key,
    required this.siteName,
    required this.message,
    this.onCheckAgain,
    this.isChecking = false,
  });

  final String siteName;
  final String message;
  final VoidCallback? onCheckAgain;
  final bool isChecking;

  @override
  Widget build(BuildContext context) {
    final muted = context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.build_outlined, size: AppSpacing.iconLg, color: context.colors.primary),
                const SizedBox(height: AppSpacing.xl),
                Text(
                  StoreStrings.closedTitle(siteName),
                  style: context.text.titleLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(message, style: muted, textAlign: TextAlign.center),
                const SizedBox(height: AppSpacing.xxl),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.schedule,
                      size: AppSpacing.iconSm,
                      color: context.colors.onSurfaceVariant,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(StoreStrings.checkBackShortly, style: context.text.bodySmall),
                  ],
                ),
                if (onCheckAgain != null) ...[
                  const SizedBox(height: AppSpacing.xl),
                  AppButton.secondary(
                    label: StoreStrings.checkAgain,
                    icon: Icons.refresh,
                    isLoading: isChecking,
                    expand: false,
                    onPressed: onCheckAgain,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
