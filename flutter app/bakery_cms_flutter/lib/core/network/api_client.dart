import 'package:dio/dio.dart';

import '../error/app_exception.dart';
import '../error/server_exception.dart';
import 'api_envelope.dart';

/// The only class that talks to Dio. Remote data sources call this and get
/// back the response payload (already unwrapped from the envelope) or a typed
/// [AppException], never a `DioException`.
class ApiClient {
  const ApiClient(this._dio);

  final Dio _dio;

  Future<Object?> get(String path, {Map<String, dynamic>? query}) =>
      _send(() => _dio.get<Object?>(path, queryParameters: query));

  Future<Object?> post(String path, {Object? body}) =>
      _send(() => _dio.post<Object?>(path, data: body));

  Future<Object?> patch(String path, {Object? body}) =>
      _send(() => _dio.patch<Object?>(path, data: body));

  /// [fromShop] names the shop's own origin, for the endpoints that refuse a
  /// request they cannot tell came from the shop (see [postMultipart]).
  Future<Object?> delete(String path, {bool fromShop = false}) =>
      _send(() => _dio.delete<Object?>(path, options: fromShop ? _fromShop : null));

  /// Sends one file as a multipart form, under [field].
  ///
  /// The shop refuses uploads it cannot tell came from itself (its
  /// cross-site check wants an `Origin` whose host is the `Host` it was
  /// called on), and a phone sends neither `Origin` nor `Sec-Fetch-Site` by
  /// itself. So this names the shop's own origin, the one the app is built
  /// against.
  Future<Object?> postMultipart(
    String path, {
    required String field,
    required String filePath,
    String? filename,
  }) => _send(() async {
    final name = filename ?? filePath.split(RegExp(r'[/\\]')).last;
    final form = FormData.fromMap({
      field: await MultipartFile.fromFile(
        filePath,
        filename: name,
        contentType: DioMediaType.parse(mimeTypeFor(name)),
      ),
    });
    return _dio.post<Object?>(path, data: form, options: _fromShop);
  });

  Options get _fromShop => Options(headers: {'Origin': Uri.parse(_dio.options.baseUrl).origin});

  /// The image type a file name says it is. The shop sniffs the bytes
  /// anyway; this only labels the part honestly.
  static String mimeTypeFor(String filename) {
    final dot = filename.lastIndexOf('.');
    final extension = dot < 0 ? '' : filename.substring(dot + 1).toLowerCase();
    return switch (extension) {
      'png' => 'image/png',
      'webp' => 'image/webp',
      'jpg' || 'jpeg' => 'image/jpeg',
      _ => 'application/octet-stream',
    };
  }

  Future<Object?> _send(Future<Response<Object?>> Function() request) async {
    try {
      final response = await request();
      return ApiEnvelope.unwrap(response.data);
    } on DioException catch (e) {
      final error = e.error;
      if (error is AppException) throw error;
      throw const ServerException();
    }
  }
}
