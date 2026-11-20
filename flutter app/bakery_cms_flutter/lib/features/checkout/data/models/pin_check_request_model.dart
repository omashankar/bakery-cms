import 'package:json_annotation/json_annotation.dart';

import '../../domain/entities/pin_check_request.dart';
import 'location_model.dart';

part 'pin_check_request_model.g.dart';

/// The `POST /api/checkout/delivery-pin` body.
@JsonSerializable(createFactory: false, explicitToJson: true)
class PinCheckRequestModel {
  const PinCheckRequestModel({
    required this.location,
    required this.pincode,
    required this.city,
    required this.state,
  });

  factory PinCheckRequestModel.fromEntity(PinCheckRequest request) => PinCheckRequestModel(
    location: LocationModel.fromEntity(request.location),
    pincode: request.pincode.trim(),
    city: request.city.trim(),
    state: request.state.trim(),
  );

  final LocationModel location;
  final String pincode;
  final String city;
  final String state;

  Map<String, dynamic> toJson() => _$PinCheckRequestModelToJson(this);
}
