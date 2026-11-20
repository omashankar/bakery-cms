import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/bloc/auth_status.dart';

/// Tells the router to re-check its redirects when the customer signs in or
/// out, and only then (not on every auth state change).
class AuthRefreshListenable extends ChangeNotifier {
  AuthRefreshListenable(AuthBloc authBloc) : _status = authBloc.state.status {
    _subscription = authBloc.stream.listen((state) {
      if (state.status == _status) return;
      _status = state.status;
      notifyListeners();
    });
  }

  late final StreamSubscription<Object?> _subscription;
  AuthStatus _status;

  @override
  void dispose() {
    unawaited(_subscription.cancel());
    super.dispose();
  }
}
