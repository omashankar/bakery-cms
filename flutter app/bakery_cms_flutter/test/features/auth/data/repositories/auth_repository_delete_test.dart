import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/network/session_events.dart';
import 'package:bakery_cms_flutter/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:bakery_cms_flutter/features/auth/data/models/customer_model.dart';
import 'package:bakery_cms_flutter/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockRemote extends Mock implements AuthRemoteDataSource {}

class _MockCookieJar extends Mock implements CookieJar {}

/// Deleting the account forgets this device's session only once the shop has
/// confirmed it: a customer must never see "deleted" over a live account.
void main() {
  late _MockRemote remote;
  late _MockCookieJar jar;
  late SessionEvents events;
  late AuthRepositoryImpl repository;

  final account = CustomerModel.fromJson(const {
    'id': 'cust-1',
    'email': 'riya@example.com',
    'name': 'Riya Sharma',
    'phone': '9876543210',
  });

  setUpAll(() => registerFallbackValue(Uri()));

  setUp(() async {
    remote = _MockRemote();
    jar = _MockCookieJar();
    events = SessionEvents();
    when(jar.deleteAll).thenAnswer((_) async {});
    when(() => jar.loadForRequest(any())).thenAnswer((_) async => <Cookie>[]);
    repository = AuthRepositoryImpl(remote: remote, cookieJar: jar, sessionEvents: events);
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) async => account);
    await repository.restoreSession();
  });

  tearDown(() async {
    await repository.dispose();
    await events.dispose();
  });

  test('a confirmed deletion signs this device out', () async {
    when(() => remote.deleteAccount()).thenAnswer((_) async {});
    final changes = <Object?>[];
    final sub = repository.customerChanges.listen(changes.add);

    final result = await repository.deleteAccount();
    await Future<void>.delayed(Duration.zero);

    expect(result.isRight(), isTrue);
    expect(repository.currentCustomer, isNull);
    expect(changes, [null]);
    verify(jar.deleteAll).called(1);
    await sub.cancel();
  });

  test('a refused deletion keeps the customer signed in and says why', () async {
    when(
      () => remote.deleteAccount(),
    ).thenThrow(const ServerException(message: 'Accounts can only be deleted from this shop.'));

    final result = await repository.deleteAccount();

    expect(result.getLeft().toNullable()?.message, 'Accounts can only be deleted from this shop.');
    expect(repository.currentCustomer, isNotNull);
    verifyNever(jar.deleteAll);
  });
}
