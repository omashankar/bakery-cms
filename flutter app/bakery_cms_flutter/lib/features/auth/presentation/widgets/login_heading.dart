import 'package:flutter/material.dart';

import '../../../../core/constants/app_spacing.dart';
import '../../../../core/utils/context_extensions.dart';

/// The title and explanation above each sign-in step.
class LoginHeading extends StatelessWidget {
  const LoginHeading({super.key, required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          Icons.mark_email_read_outlined,
          size: AppSpacing.iconLg,
          color: context.colors.primary,
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(title, style: context.text.headlineSmall),
        const SizedBox(height: AppSpacing.sm),
        Text(
          message,
          style: context.text.bodyMedium?.copyWith(color: context.colors.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.xl),
      ],
    );
  }
}
