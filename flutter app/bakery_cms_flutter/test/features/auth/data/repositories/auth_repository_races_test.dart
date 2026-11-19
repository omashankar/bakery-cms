import 'dart:async';

import 'package:bakery_cms_flutter/core/error/network_exception.dart';
import 'package:bakery_cms_flutter/core/network/session_events.dart';
import 'package:bakery_cms_flutter/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:bakery_cms_flutter/features/auth/data/models/customer_model.dart';
import 'package:bakery_cms_flutter/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockRemote extends Mock implements AuthRemoteDataSource {}

class _MockCookieJar extends Mock implements CookieJar {}

void main() {
  late _MockRemote remote;
  late SessionEvents events;
  late AuthRepositoryImpl repository;

  final account = CustomerModel.fromJson(const {
    'id': 'cust-1',
    'email': 'riya@example.com',
    'name': 'Riya Sharma',
    'phone': '9876543210',
  });

  setUpAll(() => registerFallbackValue(Uri()));

  setUp(() {
    remote = _MockRemote();
    events = SessionEvents();
    final jar = _MockCookieJar();
    when(jar.deleteAll).thenAnswer((_) async {});
    when(() => jar.loadForRequest(any())).thenAnswer((_) async => <Cookie>[]);
    repository = AuthRepositoryImpl(remote: remote, cookieJar: jar, sessionEvents: events);
  });

  tearDown(() async {
    await repository.dispose();
    await events.dispose();
  });

  test('a slow "who is signed in?" answered after a sign-in does not sign them out', () async {
    // The background retry asks /me while signed out...
    final slowMe = Completer<CustomerModel?>();
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) => slowMe.future);
    final restoring = repository.restoreSession();

    // ...the customer signs in meanwhile...
    when(
      () => remote.verifyCode(
        email: any(named: 'email'),
        code: any(named: 'code'),
      ),
    ).thenAnswer((_) async => account);
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) async => account);
    await repository.verifyCode(email: 'riya@example.com', code: '123456');
    expect(repository.currentCustomer, isNotNull);

    // ...and only then does the old /me answer "nobody".
    slowMe.complete(null);
    await restoring;

    expect(repository.currentCustomer, isNotNull);
  });

  test('signed in even when reading the account right after fails', () async {
    when(
      () => remote.verifyCode(
        email: any(named: 'email'),
        code: any(named: 'code'),
      ),
    ).thenAnswer((_) async => account);
    when(() => remote.fetchCurrentCustomer()).thenThrow(const NetworkException());

    final result = await repository.verifyCode(email: 'riya@example.com', code: '123456');

    expect(result.isRight(), isTrue, reason: 'the code is spent; failing here strands them');
    expect(repository.currentCustomer?.email, 'riya@example.com');
  });
}
