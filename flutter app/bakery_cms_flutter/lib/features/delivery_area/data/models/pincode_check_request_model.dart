import 'package:json_annotation/json_annotation.dart';

part 'pincode_check_request_model.g.dart';

/// The `POST /api/checkout/delivery-pin` body for a PIN code alone. Without
/// a `location` the server answers by the PIN's post offices.
@JsonSerializable(createFactory: false)
class PincodeCheckRequestModel {
  const PincodeCheckRequestModel(this.pincode);

  final String pincode;

  Map<String, dynamic> toJson() => _$PincodeCheckRequestModelToJson(this);
}
