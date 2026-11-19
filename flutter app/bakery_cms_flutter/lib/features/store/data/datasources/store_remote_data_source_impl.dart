import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/public_settings_model.dart';
import 'store_remote_data_source.dart';

class StoreRemoteDataSourceImpl implements StoreRemoteDataSource {
  const StoreRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  @override
  Future<PublicSettingsModel> fetchPublicSettings() async {
    final data = await _client.get(ApiEndpoints.publicSettings);
    if (data is! Map<String, dynamic>) throw const ServerException();
    return PublicSettingsModel.fromJson(data);
  }
}
