import 'package:bakery_cms_flutter/core/error/network_exception.dart';
import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/network/session_events.dart';
import 'package:bakery_cms_flutter/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:bakery_cms_flutter/features/auth/data/models/customer_model.dart';
import 'package:bakery_cms_flutter/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../auth_fixtures.dart';

class _MockRemote extends Mock implements AuthRemoteDataSource {}

class _MockCookieJar extends Mock implements CookieJar {}

void main() {
  late _MockRemote remote;
  late _MockCookieJar cookieJar;
  late SessionEvents sessionEvents;
  late AuthRepositoryImpl repository;

  final customerModel = CustomerModel.fromJson(const {
    'id': 'cust-1',
    'email': 'riya@example.com',
    'name': 'Riya Sharma',
    'phone': '9876543210',
  });

  setUpAll(() => registerFallbackValue(Uri()));

  setUp(() {
    remote = _MockRemote();
    cookieJar = _MockCookieJar();
    sessionEvents = SessionEvents();
    when(() => cookieJar.deleteAll()).thenAnswer((_) async {});
    when(() => cookieJar.loadForRequest(any())).thenAnswer((_) async => <Cookie>[]);
    repository = AuthRepositoryImpl(
      remote: remote,
      cookieJar: cookieJar,
      sessionEvents: sessionEvents,
    );
  });

  tearDown(() async {
    await repository.dispose();
    await sessionEvents.dispose();
  });

  test('verify reads the full account and announces the customer', () async {
    when(
      () => remote.verifyCode(
        email: any(named: 'email'),
        code: any(named: 'code'),
      ),
    ).thenAnswer((_) async => customerModel);
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) async => customerModel);

    final emitted = expectLater(repository.customerChanges, emits(testCustomer));
    final result = await repository.verifyCode(email: 'riya@example.com', code: '123456');

    expect(result, const Right<Never, Customer>(testCustomer));
    expect(repository.currentCustomer, testCustomer);
    await emitted;
  });

  test('a refused code is a ServerFailure carrying the shop’s message', () async {
    when(
      () => remote.verifyCode(
        email: any(named: 'email'),
        code: any(named: 'code'),
      ),
    ).thenThrow(const ServerException(message: 'That code has expired.', statusCode: 400));

    final result = await repository.verifyCode(email: 'riya@example.com', code: '123456');

    expect(
      result,
      const Left<ServerFailure, Never>(ServerFailure('That code has expired.', null, 400)),
    );
    expect(repository.currentCustomer, isNull);
  });

  test('a 401 anywhere clears the cookie jar and signs the app out', () async {
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) async => customerModel);
    await repository.restoreSession();

    final emitted = expectLater(repository.customerChanges, emits(isNull));
    sessionEvents.notifyExpired();
    await emitted;

    verify(() => cookieJar.deleteAll()).called(1);
    expect(repository.currentCustomer, isNull);
  });

  test('sign-out clears the device even when the shop cannot be reached', () async {
    when(() => remote.logout()).thenThrow(const NetworkException());

    final result = await repository.signOut();

    expect(result.isRight(), isTrue);
    verify(() => cookieJar.deleteAll()).called(1);
    expect(repository.currentCustomer, isNull);
  });

  test('a signed-out visitor restores to null, not a failure', () async {
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) async => null);

    final result = await repository.restoreSession();

    expect(result, const Right<Never, Customer?>(null));
  });
}
