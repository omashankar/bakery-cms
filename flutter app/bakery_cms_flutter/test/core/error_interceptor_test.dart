import 'dart:convert';
import 'dart:typed_data';

import 'package:bakery_cms_flutter/core/constants/api_endpoints.dart';
import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/error/unauthorized_exception.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/core/network/interceptors/error_interceptor.dart';
import 'package:bakery_cms_flutter/core/network/session_events.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Answers every request with [status] and a JSON [body].
class _FixedAdapter implements HttpClientAdapter {
  _FixedAdapter(this.status, this.body);

  final int status;
  final Map<String, dynamic> body;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? _, Future<void>? _) async =>
      ResponseBody.fromString(
        jsonEncode(body),
        status,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

  @override
  void close({bool force = false}) {}
}

void main() {
  late SessionEvents events;
  late int expired;

  setUp(() {
    events = SessionEvents();
    expired = 0;
    events.expired.listen((_) => expired++);
  });

  ApiClient client(int status, Map<String, dynamic> body) {
    final dio = Dio(BaseOptions(baseUrl: 'http://shop.test'))
      ..httpClientAdapter = _FixedAdapter(status, body)
      ..interceptors.add(ErrorInterceptor(events));
    return ApiClient(dio);
  }

  Map<String, dynamic> envelope(String message, [List<Map<String, String>>? errors]) => {
    'success': false,
    'message': message,
    'data': null,
    'errors': errors,
  };

  test('a wrong sign-in code shows the shop\'s words and keeps the session', () async {
    final api = client(401, envelope('That code is not right, or it has expired.'));
    await expectLater(
      api.post(ApiEndpoints.verifyCode),
      throwsA(
        isA<ServerException>().having(
          (e) => e.message,
          'message',
          'That code is not right, or it has expired.',
        ),
      ),
    );
    await Future<void>.delayed(Duration.zero);
    expect(expired, 0, reason: 'a refused code is not a lost session');
  });

  test('a 401 on any other call is a lost session', () async {
    final api = client(401, envelope('Not authenticated'));
    await expectLater(api.get(ApiEndpoints.myOrders), throwsA(isA<UnauthorizedException>()));
    await Future<void>.delayed(Duration.zero);
    expect(expired, 1);
  });

  test('a 422 shows the field\'s own message, not "Validation failed"', () async {
    final api = client(
      422,
      envelope('Validation failed', [
        {'field': 'address.email', 'message': 'Please enter a valid email'},
      ]),
    );
    await expectLater(
      api.post(ApiEndpoints.quote),
      throwsA(
        isA<ServerException>()
            .having((e) => e.message, 'message', 'Please enter a valid email')
            .having((e) => e.field, 'field', 'address.email'),
      ),
    );
  });

  test('a blocked account (403 on an account call) signs out and says why', () async {
    final api = client(403, envelope('This account can no longer sign in'));
    await expectLater(
      api.get(ApiEndpoints.myOrders),
      throwsA(
        isA<ServerException>().having(
          (e) => e.message,
          'message',
          'This account can no longer sign in',
        ),
      ),
    );
    await Future<void>.delayed(Duration.zero);
    expect(expired, 1);
  });

  group('a 403 that is not about the account keeps the customer signed in', () {
    // lib/server/http/same-site.ts refuses these when the Origin host is not
    // the Host — a phone behind a different base URL, a proxy that rewrites
    // Host. The shop's own words say what to do; signing out does not help.
    const refusals = {
      '/api/customer-auth/avatar': 'Photo uploads are only accepted from this shop.',
      ApiEndpoints.me: 'Accounts can only be deleted from this shop.',
      '/api/uploads/photo-cake': 'Photo uploads are only accepted from this shop.',
    };
    for (final MapEntry(key: path, value: message) in refusals.entries) {
      test('$path: $message', () async {
        final api = client(403, envelope(message));
        await expectLater(
          path == ApiEndpoints.me ? api.delete(path, fromShop: true) : api.post(path),
          throwsA(
            isA<ServerException>()
                .having((e) => e.message, 'message', message)
                .having((e) => e.statusCode, 'statusCode', 403),
          ),
        );
        await Future<void>.delayed(Duration.zero);
        expect(expired, 0, reason: 'a same-site refusal is not a lost session');
      });
    }

    test('a near miss of the account-gone wording is not a sign-out either', () async {
      for (final message in [
        'You do not have permission to do this',
        'This account can no longer sign in to the admin',
        'this account can no longer sign in',
      ]) {
        final api = client(403, envelope(message));
        await expectLater(api.get(ApiEndpoints.me), throwsA(isA<ServerException>()));
      }
      await Future<void>.delayed(Duration.zero);
      expect(expired, 0);
    });
  });

  test('the account-gone 403 signs out wherever it comes from (a photo-cake upload)', () async {
    // requireCustomer guards the photo-cake upload too, outside /api/customer-auth/.
    final api = client(403, envelope(ErrorInterceptor.accountGoneMessage));
    await expectLater(
      api.post('/api/uploads/photo-cake'),
      throwsA(
        isA<ServerException>().having(
          (e) => e.message,
          'message',
          'This account can no longer sign in',
        ),
      ),
    );
    await Future<void>.delayed(Duration.zero);
    expect(expired, 1);
  });

  test('a 403 elsewhere is not a sign-out', () async {
    final api = client(403, envelope('Forbidden'));
    await expectLater(api.get(ApiEndpoints.products), throwsA(isA<ServerException>()));
    await Future<void>.delayed(Duration.zero);
    expect(expired, 0);
  });

  test('a 500 never shows the body', () async {
    final api = client(500, envelope('TypeError: cannot read x of undefined'));
    await expectLater(
      api.get(ApiEndpoints.products),
      throwsA(isA<ServerException>().having((e) => e.message, 'message', isNull)),
    );
  });
}
