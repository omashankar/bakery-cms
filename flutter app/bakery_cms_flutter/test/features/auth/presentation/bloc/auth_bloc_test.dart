import 'dart:async';

import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/restore_session.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/sign_out.dart';
import 'package:bakery_cms_flutter/features/auth/domain/usecases/watch_customer.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_event.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../auth_fixtures.dart';

class _MockRestoreSession extends Mock implements RestoreSession {}

class _MockWatchCustomer extends Mock implements WatchCustomer {}

class _MockSignOut extends Mock implements SignOut {}

void main() {
  late _MockRestoreSession restoreSession;
  late _MockWatchCustomer watchCustomer;
  late _MockSignOut signOut;
  late StreamController<Customer?> changes;

  setUpAll(() => registerFallbackValue(const NoParams()));

  setUp(() {
    restoreSession = _MockRestoreSession();
    watchCustomer = _MockWatchCustomer();
    signOut = _MockSignOut();
    changes = StreamController<Customer?>.broadcast();
    when(() => watchCustomer()).thenAnswer((_) => changes.stream);
  });

  tearDown(() => changes.close());

  AuthBloc build() =>
      AuthBloc(restoreSession: restoreSession, watchCustomer: watchCustomer, signOut: signOut);

  blocTest<AuthBloc, AuthState>(
    'restores a saved session as signed in',
    setUp: () =>
        when(() => restoreSession(any())).thenAnswer((_) async => const Right(testCustomer)),
    build: build,
    act: (bloc) => bloc.add(const AuthStarted()),
    expect: () => [const AuthState.authenticated(testCustomer)],
  );

  blocTest<AuthBloc, AuthState>(
    'a visitor with no session is signed out, not an error',
    setUp: () => when(() => restoreSession(any())).thenAnswer((_) async => const Right(null)),
    build: build,
    act: (bloc) => bloc.add(const AuthStarted()),
    expect: () => [const AuthState.unauthenticated()],
  );

  blocTest<AuthBloc, AuthState>(
    'an unreachable shop counts as signed out',
    setUp: () =>
        when(() => restoreSession(any())).thenAnswer((_) async => const Left(NetworkFailure())),
    build: build,
    act: (bloc) => bloc.add(const AuthStarted()),
    expect: () => [const AuthState.unauthenticated()],
  );

  blocTest<AuthBloc, AuthState>(
    'follows the repository: sign-in by code, then session expiry (401)',
    setUp: () => when(() => restoreSession(any())).thenAnswer((_) async => const Right(null)),
    build: build,
    act: (bloc) async {
      bloc.add(const AuthStarted());
      await Future<void>.delayed(Duration.zero);
      changes.add(testCustomer);
      await Future<void>.delayed(Duration.zero);
      changes.add(null);
    },
    expect: () => [
      const AuthState.unauthenticated(),
      const AuthState.authenticated(testCustomer),
      const AuthState.unauthenticated(),
    ],
  );

  blocTest<AuthBloc, AuthState>(
    'signing out signs the app out',
    setUp: () => when(() => signOut(any())).thenAnswer((_) async => const Right(unit)),
    build: build,
    seed: () => const AuthState.authenticated(testCustomer),
    act: (bloc) => bloc.add(const AuthSignOutRequested()),
    expect: () => [const AuthState.unauthenticated()],
    verify: (_) => verify(() => signOut(any())).called(1),
  );
}
