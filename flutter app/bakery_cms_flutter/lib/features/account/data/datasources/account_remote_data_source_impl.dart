import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../../../auth/data/models/customer_model.dart';
import 'account_remote_data_source.dart';

class AccountRemoteDataSourceImpl implements AccountRemoteDataSource {
  const AccountRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  /// `POST` (multipart, part [avatarField]) sets it; `DELETE` removes it.
  static const String avatarPath = '/api/customer-auth/avatar';
  static const String avatarField = 'photo';

  @override
  Future<CustomerModel> updateProfile({required String name, String? phone}) async {
    final data = await _client.patch(
      ApiEndpoints.profile,
      body: {'name': name, 'phone': ?phone},
    );
    return _customer(data);
  }

  @override
  Future<CustomerModel> uploadAvatar(String filePath) async => _customer(
        await _client.postMultipart(avatarPath, field: avatarField, filePath: filePath),
      );

  @override
  Future<CustomerModel> removeAvatar() async => _customer(await _client.delete(avatarPath));

  static CustomerModel _customer(Object? data) {
    if (data is! Map<String, dynamic>) throw const ServerException();
    return CustomerModel.fromJson(data);
  }
}
