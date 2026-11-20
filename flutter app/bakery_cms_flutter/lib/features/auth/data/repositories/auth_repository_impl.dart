import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/foundation.dart';
import 'package:fpdart/fpdart.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/error/app_exception.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/session_cookie.dart';
import '../../../../core/network/session_events.dart';
import '../../domain/entities/customer.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_data_source.dart';
import '../models/customer_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  /// [shopUri] is where the session cookie lives; the app's own shop unless a
  /// test says otherwise.
  AuthRepositoryImpl({
    required AuthRemoteDataSource remote,
    required CookieJar cookieJar,
    required SessionEvents sessionEvents,
    Uri? shopUri,
  }) : _remote = remote,
       _cookieJar = cookieJar,
       _shopUri = shopUri ?? Uri.parse(ApiEndpoints.baseUrl) {
    // Any 401 anywhere means the shop has forgotten this session: the device
    // must forget it too, or every signed-in screen keeps failing.
    _expirySubscription = sessionEvents.expired.listen((_) => unawaited(_forgetSession()));
  }

  final AuthRemoteDataSource _remote;
  final CookieJar _cookieJar;
  final Uri _shopUri;
  final StreamController<Customer?> _changes = StreamController<Customer?>.broadcast();
  final StreamController<void> _ended = StreamController<void>.broadcast();
  late final StreamSubscription<void> _expirySubscription;
  Customer? _current;

  /// Bumped by every sign-in, sign-out and profile save, so a slower
  /// restore can tell that what it fetched is out of date.
  int _generation = 0;

  @override
  Stream<Customer?> get customerChanges => _changes.stream;

  @override
  Customer? get currentCustomer => _current;

  @override
  Stream<void> get sessionEnded => _ended.stream;

  @override
  Future<Either<Failure, Customer?>> restoreSession() => guard(() async {
    final asked = _generation;
    final customer = (await _remote.fetchCurrentCustomer())?.toEntity();
    // A sign-in or sign-out while this was in flight is newer news. A
    // background retry sent before the customer signed in, and answered
    // after, must not sign them straight back out.
    if (asked != _generation) return _current;
    if (customer == null && (_current != null || await _holdsSessionCookie())) {
      // The shop answers "nobody" (200, data null) for a session it no
      // longer honours: expired, or its account blocked or deleted. The
      // website treats a cached customer meeting that answer as a lapsed
      // session and wipes the device (`applyServerCustomer(null)` →
      // `clearLocalCustomerData`). The app's equivalent of that cache is
      // the cookie it kept; a visitor who never signed in has none.
      if (asked != _generation) return _current;
      await _forgetSession();
      return null;
    }
    _set(customer);
    return customer;
  });

  @override
  Future<Either<Failure, Unit>> requestCode({required String email, String? name}) =>
      guard(() async {
        await _remote.requestCode(email: email, name: name);
        return unit;
      });

  @override
  Future<Either<Failure, Customer>> verifyCode({required String email, required String code}) =>
      guard(() async {
        final verified = await _remote.verifyCode(email: email, code: code);
        // From here the customer IS signed in (the cookie is set and the code
        // is spent). `me` carries the whole account (phone, photo); if that
        // second read fails or comes back empty, the verify reply stands in,
        // rather than reporting a failure that sends them to retype a code
        // that no longer works.
        CustomerModel? account;
        try {
          account = await _remote.fetchCurrentCustomer();
        } on AppException catch (error) {
          debugPrint('Signed in, but reading the account failed: $error');
        }
        account ??= verified;
        if (account == null) throw const ServerException();
        final customer = account.toEntity();
        _generation++;
        _set(customer);
        return customer;
      });

  @override
  Future<Either<Failure, Unit>> signOut() async {
    try {
      await _remote.logout();
    } catch (error) {
      // Signing out of this device must not depend on reaching the shop.
      debugPrint('Sign-out request failed, clearing the session locally: $error');
    }
    await _forgetSession();
    return const Right(unit);
  }

  @override
  Future<Either<Failure, Unit>> deleteAccount() async {
    final deleted = await guard(_remote.deleteAccount);
    if (deleted.isLeft()) return deleted.map((_) => unit);
    await _forgetSession();
    return const Right(unit);
  }

  @override
  void customerUpdated(Customer customer) {
    _generation++;
    _set(customer);
  }

  /// Forgets the session on this device, and announces that it ended when
  /// there was one to end: a 401 that reaches a signed-out app (a request
  /// still in flight from before) must not wipe a guest's cart.
  Future<void> _forgetSession() async {
    final hadCustomer = _current != null;
    // Bumped before anything awaits, so a restore answered meanwhile is stale.
    _generation++;
    final hadSession = hadCustomer || await _holdsSessionCookie();
    await _cookieJar.deleteAll();
    _set(null);
    if (hadSession && !_ended.isClosed) _ended.add(null);
  }

  /// Whether the jar still holds the shop's sign-in cookie. A jar that cannot
  /// be read counts as holding none: the wipe it would trigger is for a
  /// session we can no longer prove existed.
  Future<bool> _holdsSessionCookie() async {
    try {
      final cookies = await _cookieJar.loadForRequest(_shopUri);
      return cookies.any((cookie) => cookie.name == SessionCookie.name);
    } on Exception catch (error) {
      debugPrint('Could not read the cookie jar: $error');
      return false;
    }
  }

  void _set(Customer? customer) {
    if (customer == _current && customer != null) return;
    _current = customer;
    _changes.add(customer);
  }

  @visibleForTesting
  Future<void> dispose() async {
    await _expirySubscription.cancel();
    await _changes.close();
    await _ended.close();
  }
}
