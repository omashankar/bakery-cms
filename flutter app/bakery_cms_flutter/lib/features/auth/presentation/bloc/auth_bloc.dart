import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/constants/app_durations.dart';
import '../../../../core/error/unauthorized_failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../domain/entities/customer.dart';
import '../../domain/usecases/restore_session.dart';
import '../../domain/usecases/sign_out.dart';
import '../../domain/usecases/watch_customer.dart';
import 'auth_event.dart';
import 'auth_state.dart';
import 'auth_status.dart';

/// App-wide: is someone signed in, and who. The router redirects from this
/// state, so no screen navigates on sign-in or sign-out itself.
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({
    required RestoreSession restoreSession,
    required WatchCustomer watchCustomer,
    required SignOut signOut,
    List<Duration> retryDelays = AppDurations.backgroundRetries,
  }) : _restoreSession = restoreSession,
       _watchCustomer = watchCustomer,
       _signOut = signOut,
       _retryDelays = retryDelays,
       super(const AuthState()) {
    on<AuthStarted>(_onStarted);
    on<AuthSignOutRequested>(_onSignOutRequested);
  }

  final RestoreSession _restoreSession;
  final WatchCustomer _watchCustomer;
  final SignOut _signOut;
  final List<Duration> _retryDelays;
  Timer? _retry;
  int _attempt = 0;

  Future<void> _onStarted(AuthStarted event, Emitter<AuthState> emit) async {
    final restored = await _restoreSession(const NoParams());
    // A shop that cannot be reached counts as signed out for now: the visitor
    // can still browse. But the cookie may well be valid, so ask again in the
    // background; a success arrives through the customer stream below, and
    // the router then takes them off the sign-in page to where they were
    // going. Only a 401 is a real "signed out", and that is not retried.
    emit(restored.match((_) => const AuthState.unauthenticated(), _stateFor));
    restored.match((failure) {
      if (failure is! UnauthorizedFailure) _scheduleRetry();
    }, (_) {});
    await emit.forEach<Customer?>(_watchCustomer(), onData: _stateFor);
  }

  void _scheduleRetry() {
    if (_attempt >= _retryDelays.length) return;
    _retry = Timer(_retryDelays[_attempt++], () async {
      if (isClosed || state.status == AuthStatus.authenticated) return;
      final again = await _restoreSession(const NoParams());
      if (isClosed) return;
      again.match((failure) {
        if (failure is! UnauthorizedFailure) _scheduleRetry();
      }, (_) {});
    });
  }

  @override
  Future<void> close() {
    _retry?.cancel();
    return super.close();
  }

  Future<void> _onSignOutRequested(AuthSignOutRequested event, Emitter<AuthState> emit) async {
    await _signOut(const NoParams());
    emit(const AuthState.unauthenticated());
  }

  static AuthState _stateFor(Customer? customer) =>
      customer == null ? const AuthState.unauthenticated() : AuthState.authenticated(customer);
}
