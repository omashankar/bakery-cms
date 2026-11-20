import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/order_address.dart';

part 'order_address_model.g.dart';

@JsonSerializable(createToJson: false)
class OrderAddressModel {
  const OrderAddressModel({
    required this.fullName,
    required this.email,
    required this.phone,
    required this.addressLine1,
    required this.city,
    required this.state,
    required this.pincode,
    this.addressLine2,
    this.landmark,
    this.addressLabel,
  });

  factory OrderAddressModel.fromJson(Map<String, dynamic> json) =>
      _$OrderAddressModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String fullName;
  @JsonKey(fromJson: JsonReaders.string)
  final String email;
  @JsonKey(fromJson: JsonReaders.string)
  final String phone;
  @JsonKey(fromJson: JsonReaders.string)
  final String addressLine1;
  final String? addressLine2;
  final String? landmark;
  @JsonKey(fromJson: JsonReaders.string)
  final String city;
  @JsonKey(fromJson: JsonReaders.string)
  final String state;
  @JsonKey(fromJson: JsonReaders.string)
  final String pincode;
  final String? addressLabel;

  OrderAddress toEntity() => OrderAddress(
    fullName: fullName,
    email: email,
    phone: phone,
    addressLine1: addressLine1,
    addressLine2: addressLine2,
    landmark: landmark,
    city: city,
    state: state,
    pincode: pincode,
    label: addressLabel,
  );
}
