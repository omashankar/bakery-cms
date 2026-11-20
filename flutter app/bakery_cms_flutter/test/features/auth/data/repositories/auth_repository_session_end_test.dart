import 'package:bakery_cms_flutter/core/error/network_exception.dart';
import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/network/session_cookie.dart';
import 'package:bakery_cms_flutter/core/network/session_events.dart';
import 'package:bakery_cms_flutter/features/auth/data/datasources/auth_remote_data_source.dart';
import 'package:bakery_cms_flutter/features/auth/data/models/customer_model.dart';
import 'package:bakery_cms_flutter/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockRemote extends Mock implements AuthRemoteDataSource {}

/// `sessionEnded` is what wipes the cart and the wishlist, so it must fire on
/// every way a customer's session ends on this phone (the website wipes on
/// sign-out, on deletion, and when the server answers "nobody" over a cached
/// session) and never for a visitor who was not signed in: their cart is
/// theirs.
///
/// A real in-memory [CookieJar], so "the jar still holds the sign-in cookie"
/// is the jar's own answer and not a stub's.
void main() {
  final shop = Uri.parse('http://shop.test');
  late _MockRemote remote;
  late CookieJar jar;
  late SessionEvents events;
  late AuthRepositoryImpl repository;
  late int ended;

  final account = CustomerModel.fromJson(const {
    'id': 'cust-1',
    'email': 'riya@example.com',
    'name': 'Riya Sharma',
    'phone': '9876543210',
  });

  Future<void> holdSessionCookie() =>
      jar.saveFromResponse(shop, [Cookie(SessionCookie.name, 'token')]);

  Future<bool> jarHoldsSession() async =>
      (await jar.loadForRequest(shop)).any((c) => c.name == SessionCookie.name);

  Future<void> signIn() async {
    await holdSessionCookie();
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) async => account);
    await repository.restoreSession();
    expect(repository.currentCustomer, isNotNull);
  }

  Future<void> settle() async {
    for (var i = 0; i < 5; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  setUp(() {
    remote = _MockRemote();
    jar = CookieJar();
    events = SessionEvents();
    repository = AuthRepositoryImpl(
      remote: remote,
      cookieJar: jar,
      sessionEvents: events,
      shopUri: shop,
    );
    ended = 0;
    repository.sessionEnded.listen((_) => ended++);
  });

  tearDown(() async {
    await repository.dispose();
    await events.dispose();
  });

  test('signing out ends the session, even when the shop cannot be reached', () async {
    await signIn();
    when(() => remote.logout()).thenThrow(const NetworkException());

    await repository.signOut();
    await settle();

    expect(ended, 1);
    expect(await jarHoldsSession(), isFalse);
  });

  test('a confirmed account deletion ends the session', () async {
    await signIn();
    when(() => remote.deleteAccount()).thenAnswer((_) async {});

    await repository.deleteAccount();
    await settle();

    expect(ended, 1);
  });

  test('a refused account deletion ends nothing', () async {
    await signIn();
    when(
      () => remote.deleteAccount(),
    ).thenThrow(const ServerException(message: 'Accounts can only be deleted from this shop.'));

    await repository.deleteAccount();
    await settle();

    expect(ended, 0);
    expect(repository.currentCustomer, isNotNull);
  });

  test('a 401 while signed in ends the session', () async {
    await signIn();

    events.notifyExpired();
    await settle();

    expect(ended, 1);
  });

  test('a 401 reaching a signed-out app with no cookie ends nothing', () async {
    // A guest keeps their cart.
    events.notifyExpired();
    await settle();

    expect(ended, 0);
  });

  test('a cold start whose kept cookie the shop no longer honours is a lapsed session', () async {
    // The account was blocked or deleted while the app was closed: /me says
    // "nobody" (200, data null) over a cookie this phone still holds.
    await holdSessionCookie();
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) async => null);

    final result = await repository.restoreSession();
    await settle();

    expect(result.getRight().toNullable(), isNull);
    expect(ended, 1);
    expect(await jarHoldsSession(), isFalse, reason: 'the dead cookie is dropped too');
  });

  test('a visitor who never signed in restores to nobody and ends nothing', () async {
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) async => null);

    await repository.restoreSession();
    await settle();

    expect(ended, 0);
  });

  test('a background restore that finds a signed-in customer gone ends the session', () async {
    await signIn();
    when(() => remote.fetchCurrentCustomer()).thenAnswer((_) async => null);

    await repository.restoreSession();
    await settle();

    expect(ended, 1);
    expect(repository.currentCustomer, isNull);
  });

  test('a failed restore (shop unreachable) ends nothing', () async {
    await holdSessionCookie();
    when(() => remote.fetchCurrentCustomer()).thenThrow(const NetworkException());

    await repository.restoreSession();
    await settle();

    expect(ended, 0);
    expect(await jarHoldsSession(), isTrue, reason: 'the cookie may well be valid');
  });
}
