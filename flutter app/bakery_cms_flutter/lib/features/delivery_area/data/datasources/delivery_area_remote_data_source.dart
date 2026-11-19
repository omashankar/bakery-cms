import '../models/delivery_area_model.dart';

abstract interface class DeliveryAreaRemoteDataSource {
  /// The shop's answer about [pincode], carrying that pincode.
  Future<DeliveryAreaModel> check(String pincode);
}
