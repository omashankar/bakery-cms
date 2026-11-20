import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import 'photo_upload_remote_data_source.dart';

class PhotoUploadRemoteDataSourceImpl implements PhotoUploadRemoteDataSource {
  const PhotoUploadRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  /// `POST`, multipart, one part named [field]. Answers `{url, bytes}`.
  static const String path = '/api/uploads/photo-cake';
  static const String field = 'photo';

  @override
  Future<String> uploadCakePhoto(String filePath) async {
    final data = await _client.postMultipart(path, field: field, filePath: filePath);
    final url = data is Map<String, dynamic> ? data['url'] : null;
    if (url is! String || url.isEmpty) throw const ServerException();
    return url;
  }
}
