import 'package:json_annotation/json_annotation.dart';

part 'delivery_area_model.g.dart';

/// The quote's `deliveryAddress`: enough to pick a zone for a running total.
@JsonSerializable(createFactory: false, includeIfNull: false)
class DeliveryAreaModel {
  const DeliveryAreaModel({this.city, this.pincode, this.state});

  final String? city;
  final String? pincode;
  final String? state;

  Map<String, dynamic> toJson() => _$DeliveryAreaModelToJson(this);
}
