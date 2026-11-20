import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/constants/strings/account_strings.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/customer_model.dart';
import 'auth_remote_data_source.dart';

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  const AuthRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  @override
  Future<void> requestCode({required String email, String? name}) async {
    await _client.post(ApiEndpoints.requestCode, body: {'email': email, 'name': ?name});
  }

  @override
  Future<CustomerModel?> verifyCode({required String email, required String code}) async {
    final data = await _client.post(ApiEndpoints.verifyCode, body: {'email': email, 'code': code});
    return _customerOrNull(data);
  }

  @override
  Future<CustomerModel?> fetchCurrentCustomer() async =>
      _customerOrNull(await _client.get(ApiEndpoints.me));

  @override
  Future<void> logout() async {
    await _client.post(ApiEndpoints.logout);
  }

  @override
  Future<void> deleteAccount() async {
    final data = await _client.delete(ApiEndpoints.me, fromShop: true);
    // The website's `deleteCustomerAccount` wipes the device only on
    // `data.deleted === true`: a customer told "deleted" over an account that
    // survived would believe something untrue about their data.
    if (data is! Map<String, dynamic> || data['deleted'] != true) {
      throw const ServerException(message: AccountStrings.deleteAccountFailed);
    }
  }

  static CustomerModel? _customerOrNull(Object? data) =>
      data is Map<String, dynamic> ? CustomerModel.fromJson(data) : null;
}
