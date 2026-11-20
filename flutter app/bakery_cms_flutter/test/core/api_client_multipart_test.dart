import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/core/network/interceptors/error_interceptor.dart';
import 'package:bakery_cms_flutter/core/network/session_events.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// Records what was sent and answers with [status] and a JSON [body].
class _RecordingAdapter implements HttpClientAdapter {
  _RecordingAdapter(this.status, this.body);

  final int status;
  final Map<String, dynamic> body;
  RequestOptions? sent;

  /// The request body as it went out (read whole, as a real adapter would:
  /// that also closes the file).
  String wire = '';

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? _,
  ) async {
    sent = options;
    final bytes = <int>[];
    await requestStream?.forEach(bytes.addAll);
    wire = latin1.decode(bytes);
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  late Directory dir;
  late String photo;
  late SessionEvents events;
  late int expired;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('multipart_test');
    photo = '${dir.path}${Platform.pathSeparator}Birthday.JPG';
    await File(photo).writeAsBytes([0xFF, 0xD8, 0xFF, 0xE0]);
    events = SessionEvents();
    expired = 0;
    events.expired.listen((_) => expired++);
  });

  tearDown(() => dir.delete(recursive: true));

  (ApiClient, _RecordingAdapter) client(int status, Map<String, dynamic> body) {
    final adapter = _RecordingAdapter(status, body);
    final dio = Dio(
      BaseOptions(baseUrl: 'http://127.0.0.1:3000', contentType: Headers.jsonContentType),
    )
      ..httpClientAdapter = adapter
      ..interceptors.add(ErrorInterceptor(events));
    return (ApiClient(dio), adapter);
  }

  Map<String, dynamic> ok(Object data) =>
      {'success': true, 'message': 'Photo uploaded', 'data': data};

  test('sends the file under the field, as multipart, and unwraps the answer', () async {
    final (api, adapter) = client(200, ok({'url': 'https://cdn.test/a.jpg', 'bytes': 4}));

    final data = await api.postMultipart('/api/uploads/photo-cake', field: 'photo', filePath: photo);

    expect(data, {'url': 'https://cdn.test/a.jpg', 'bytes': 4});
    final sent = adapter.sent!;
    expect(sent.method, 'POST');
    expect(sent.path, '/api/uploads/photo-cake');
    expect(sent.contentType, startsWith('multipart/form-data'));
    final form = sent.data as FormData;
    expect(form.fields, isEmpty);
    final part = form.files.single;
    expect(part.key, 'photo');
    expect(part.value.filename, 'Birthday.JPG');
    expect(part.value.contentType.toString(), 'image/jpeg');
    expect(
      adapter.wire,
      contains('content-disposition: form-data; name="photo"; filename="Birthday.JPG"'),
    );
    expect(adapter.wire, contains('content-type: image/jpeg'));
  });

  test('names the shop\'s own origin, port included, for its cross-site check', () async {
    final (api, adapter) = client(200, ok({'url': 'u'}));

    await api.postMultipart('/api/customer-auth/avatar', field: 'photo', filePath: photo);

    expect(adapter.sent!.headers['Origin'], 'http://127.0.0.1:3000');
  });

  test('a refused photo shows the shop\'s own words', () async {
    final (api, _) = client(422, {
      'success': false,
      'message': 'Validation failed',
      'data': null,
      'errors': [
        {'field': 'photo', 'message': 'That photo is too large. Please use an image under 6 MB.'},
      ],
    });

    await expectLater(
      api.postMultipart('/api/uploads/photo-cake', field: 'photo', filePath: photo),
      throwsA(isA<ServerException>()
          .having((e) => e.message, 'message', 'That photo is too large. Please use an image under 6 MB.')
          .having((e) => e.statusCode, 'statusCode', 422)),
    );
    await Future<void>.delayed(Duration.zero);
    expect(expired, 0);
  });

  test('a shop with no photo storage says so (503 keeps its message)', () async {
    final (api, _) = client(503, {
      'success': false,
      'message': 'Photo uploads are not set up on this shop yet.',
      'data': null,
    });

    await expectLater(
      api.postMultipart('/api/uploads/photo-cake', field: 'photo', filePath: photo),
      throwsA(isA<ServerException>()
          .having((e) => e.message, 'message', 'Photo uploads are not set up on this shop yet.')),
    );
  });

  test('delete sends DELETE and unwraps the answer', () async {
    final (api, adapter) = client(200, ok({'id': 'cust-1'}));

    expect(await api.delete('/api/customer-auth/avatar'), {'id': 'cust-1'});
    expect(adapter.sent!.method, 'DELETE');
    expect(adapter.sent!.headers['Origin'], isNull);
  });

  test('a delete from the shop names its origin, which account deletion requires', () async {
    final (api, adapter) = client(200, ok({'deleted': true}));

    await api.delete('/api/customer-auth/me', fromShop: true);

    expect(adapter.sent!.method, 'DELETE');
    expect(adapter.sent!.headers['Origin'], 'http://127.0.0.1:3000');
  });

  test('labels each image type the shop takes', () {
    expect(ApiClient.mimeTypeFor('a.jpg'), 'image/jpeg');
    expect(ApiClient.mimeTypeFor('a.JPEG'), 'image/jpeg');
    expect(ApiClient.mimeTypeFor('a.png'), 'image/png');
    expect(ApiClient.mimeTypeFor('a.webp'), 'image/webp');
    expect(ApiClient.mimeTypeFor('a.heic'), 'application/octet-stream');
    expect(ApiClient.mimeTypeFor('noextension'), 'application/octet-stream');
  });
}
