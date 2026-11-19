import 'package:flutter/material.dart';

import '../utils/view_status.dart';
import 'app_loader.dart';
import 'empty_view.dart';
import 'error_view.dart';

/// The four states every screen has, decided in one place.
///
/// - loading (first load, nothing to show yet) → [AppLoader]
/// - failure with nothing loaded → [ErrorView] with retry
/// - success but [isEmpty] → [empty] (an [EmptyView])
/// - otherwise → [builder]
///
/// A refresh that fails while content is already on screen keeps the content;
/// the page reports it with a snackbar from a `BlocListener` instead.
class StateView extends StatelessWidget {
  const StateView({
    super.key,
    required this.status,
    required this.isEmpty,
    required this.builder,
    this.errorMessage,
    this.onRetry,
    this.empty,
  });

  final ViewStatus status;
  final bool isEmpty;
  final WidgetBuilder builder;
  final String? errorMessage;
  final VoidCallback? onRetry;
  final Widget? empty;

  @override
  Widget build(BuildContext context) {
    if (isEmpty) {
      if (status.isPending) return const AppLoader();
      if (status.isFailure) {
        return ErrorView(message: errorMessage ?? '', onRetry: onRetry);
      }
      return empty ?? const EmptyView();
    }
    return builder(context);
  }
}
