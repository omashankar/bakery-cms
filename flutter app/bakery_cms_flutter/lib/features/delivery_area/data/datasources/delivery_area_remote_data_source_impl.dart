import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/delivery_area_model.dart';
import '../models/pincode_check_request_model.dart';
import 'delivery_area_remote_data_source.dart';

/// The same endpoint checkout's map pin uses ([ApiEndpoints.deliveryPin]),
/// asked with a PIN code alone.
class DeliveryAreaRemoteDataSourceImpl implements DeliveryAreaRemoteDataSource {
  const DeliveryAreaRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  @override
  Future<DeliveryAreaModel> check(String pincode) async {
    final data = await _client.post(
      ApiEndpoints.deliveryPin,
      body: PincodeCheckRequestModel(pincode).toJson(),
    );
    if (data is! Map<String, dynamic>) throw const ServerException();
    return DeliveryAreaModel.fromJson({...data, 'pincode': pincode});
  }
}
