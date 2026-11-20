import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../utils/view_status.dart';
import 'app_snackbar.dart';

/// Shows a failure as a snackbar when the screen still has content to show.
///
/// The other half of [StateView]: with nothing loaded, a failure is the
/// full-screen error view; with content on screen (a failed refresh), it is
/// this snackbar, and the content stays.
class FailureSnackbarListener<B extends StateStreamable<S>, S> extends StatelessWidget {
  const FailureSnackbarListener({
    super.key,
    required this.statusOf,
    required this.messageOf,
    required this.hasContent,
    required this.child,
  });

  final ViewStatus Function(S state) statusOf;
  final String? Function(S state) messageOf;
  final bool Function(S state) hasContent;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return BlocListener<B, S>(
      listenWhen: (previous, current) =>
          statusOf(current).isFailure && statusOf(previous) != statusOf(current),
      listener: (context, state) {
        final message = messageOf(state);
        if (message != null && hasContent(state)) AppSnackbar.error(context, message);
      },
      child: child,
    );
  }
}
