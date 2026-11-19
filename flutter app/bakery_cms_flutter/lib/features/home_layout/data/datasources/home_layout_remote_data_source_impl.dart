import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/home_layout_model.dart';
import 'home_layout_remote_data_source.dart';

class HomeLayoutRemoteDataSourceImpl implements HomeLayoutRemoteDataSource {
  const HomeLayoutRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  @override
  Future<HomeLayoutModel> fetchHomeLayout() async {
    final data = await _client.get(ApiEndpoints.storefrontHome);
    if (data is! Map<String, dynamic>) throw const ServerException();
    return HomeLayoutModel.fromJson(data);
  }
}
