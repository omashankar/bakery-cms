import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../constants/app_spacing.dart';
import '../constants/app_strings.dart';

/// Catches every error nothing else did.
///
/// - [FlutterError.onError]: errors inside the framework (build, layout).
/// - [PlatformDispatcher.onError]: uncaught async errors anywhere.
/// - [ErrorWidget.builder]: in release, a broken widget shows a calm message
///   instead of the red error screen.
///
/// The place to forward to a crash reporter later (Crashlytics, Sentry).
abstract final class AppErrorHandler {
  static void install() {
    FlutterError.onError = (details) {
      FlutterError.presentError(details);
      _report(details.exception, details.stack);
    };

    PlatformDispatcher.instance.onError = (error, stack) {
      _report(error, stack);
      return true; // handled: do not crash the app
    };

    if (kReleaseMode) {
      ErrorWidget.builder = (_) => const _FriendlyErrorWidget();
    }
  }

  static void _report(Object error, StackTrace? stack) {
    debugPrint('Uncaught error: $error\n$stack');
  }
}

class _FriendlyErrorWidget extends StatelessWidget {
  const _FriendlyErrorWidget();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.all(AppSpacing.lg),
      child: Center(child: Text(AppStrings.somethingWentWrong, textDirection: TextDirection.ltr)),
    );
  }
}
