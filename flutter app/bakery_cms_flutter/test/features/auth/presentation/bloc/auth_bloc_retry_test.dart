import 'dart:async';

import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/error/unauthorized_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/restore_session.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/sign_out.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/watch_customer.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_event.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_state.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_status.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../auth_fixtures.dart';

class _MockRestoreSession extends Mock implements RestoreSession {}

class _MockWatchCustomer extends Mock implements WatchCustomer {}

class _MockSignOut extends Mock implements SignOut {}

/// Found on a phone: opened while the network was down, the app counted a
/// signed-in customer as signed out and never asked again.
void main() {
  late _MockRestoreSession restore;
  late _MockWatchCustomer watch;
  late StreamController<Customer?> changes;
  const fast = [Duration(milliseconds: 10), Duration(milliseconds: 10)];

  setUpAll(() => registerFallbackValue(const NoParams()));

  setUp(() {
    restore = _MockRestoreSession();
    watch = _MockWatchCustomer();
    changes = StreamController<Customer?>.broadcast();
    when(() => watch()).thenAnswer((_) => changes.stream);
  });

  tearDown(() => changes.close());

  AuthBloc build() => AuthBloc(
    restoreSession: restore,
    watchCustomer: watch,
    signOut: _MockSignOut(),
    retryDelays: fast,
  );

  test('a start without network signs back in once the shop answers', () async {
    var calls = 0;
    when(() => restore(any())).thenAnswer((_) async {
      calls++;
      if (calls == 1) return const Left(NetworkFailure());
      changes.add(testCustomer); // what the repository does on success
      return const Right(testCustomer);
    });

    final bloc = build()..add(const AuthStarted());
    await bloc.stream.firstWhere((s) => s.status == AuthStatus.unauthenticated);
    final signedIn = await bloc.stream
        .firstWhere((s) => s.status == AuthStatus.authenticated)
        .timeout(const Duration(seconds: 2));

    expect(signedIn, const AuthState.authenticated(testCustomer));
    expect(calls, 2);
    await bloc.close();
  });

  test('a 401 is a real sign-out and is not retried', () async {
    when(() => restore(any())).thenAnswer((_) async => const Left(UnauthorizedFailure()));

    final bloc = build()..add(const AuthStarted());
    await bloc.stream.firstWhere((s) => s.status == AuthStatus.unauthenticated);
    await Future<void>.delayed(const Duration(milliseconds: 80));

    verify(() => restore(any())).called(1);
    await bloc.close();
  });

  test('retries stop after the last delay', () async {
    when(() => restore(any())).thenAnswer((_) async => const Left(NetworkFailure()));

    final bloc = build()..add(const AuthStarted());
    await Future<void>.delayed(const Duration(milliseconds: 150));

    verify(() => restore(any())).called(1 + fast.length);
    await bloc.close();
  });
}
