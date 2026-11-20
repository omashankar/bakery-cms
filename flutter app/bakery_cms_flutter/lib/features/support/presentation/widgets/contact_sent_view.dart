import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';
import '../../../../core/constants/app_spacing.dart';
import '../../../../core/constants/strings/support_strings.dart';
import '../../../../core/utils/context_extensions.dart';
import '../../../../core/widgets/app_button.dart';

/// The website's /store/thank-you, where the contact form lands.
class ContactSentView extends StatelessWidget {
  const ContactSentView({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(
              Icons.check_circle_outline,
              size: AppSpacing.iconXl,
              color: context.colors.primary,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              SupportStrings.sentTitle,
              style: context.text.headlineSmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              SupportStrings.sentMessage,
              style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            AppButton(
              label: SupportStrings.backToHome,
              onPressed: () => context.go(AppRoutes.home),
            ),
            const SizedBox(height: AppSpacing.md),
            AppButton.secondary(
              label: SupportStrings.browseProducts,
              onPressed: () => context.go(AppRoutes.categories),
            ),
          ],
        ),
      ),
    );
  }
}
