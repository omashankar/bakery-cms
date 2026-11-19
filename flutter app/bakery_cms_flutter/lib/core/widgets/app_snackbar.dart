import 'package:flutter/material.dart';

import '../constants/app_durations.dart';

/// One way to tell the customer something happened. Call from a
/// `BlocListener`, never from `build`.
abstract final class AppSnackbar {
  static void success(
    BuildContext context,
    String message, {
    String? actionLabel,
    VoidCallback? onAction,
  }) => _show(context, message, isError: false, actionLabel: actionLabel, onAction: onAction);

  static void error(BuildContext context, String message) => _show(context, message, isError: true);

  static void _show(
    BuildContext context,
    String message, {
    required bool isError,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    final colors = Theme.of(context).colorScheme;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          duration: actionLabel != null && onAction != null
              ? AppDurations.snackbarWithAction
              : AppDurations.snackbar,
          backgroundColor: isError ? colors.error : null,
          action: actionLabel != null && onAction != null
              ? SnackBarAction(label: actionLabel, onPressed: onAction)
              : null,
        ),
      );
  }
}
