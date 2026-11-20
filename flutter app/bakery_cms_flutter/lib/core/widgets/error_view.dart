import 'package:flutter/material.dart';

import '../constants/app_strings.dart';
import '../utils/context_extensions.dart';
import 'message_view.dart';

/// A failed load, with a way to try again. [message] is a `Failure.message`,
/// which is always written for customers.
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return MessageView(
      icon: Icons.cloud_off_outlined,
      iconColor: context.colors.error,
      title: AppStrings.somethingWentWrong,
      message: message,
      actionLabel: AppStrings.retry,
      onAction: onRetry,
    );
  }
}
