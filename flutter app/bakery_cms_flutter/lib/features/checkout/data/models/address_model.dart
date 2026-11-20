import 'package:json_annotation/json_annotation.dart';

import '../../domain/entities/checkout_address.dart';
import 'location_model.dart';
import 'optional_text.dart';

part 'address_model.g.dart';

/// The `address` object the quote and the order both take: the website's
/// `CheckoutAddress`, every field the server names (`quoteSchema.address` in
/// checkout.validators.ts strips what it does not list).
@JsonSerializable(createFactory: false, includeIfNull: false, explicitToJson: true)
class AddressModel {
  const AddressModel({
    required this.fullName,
    required this.email,
    required this.phone,
    required this.addressLine1,
    required this.city,
    required this.state,
    required this.pincode,
    required this.addressLabel,
    this.altPhone,
    this.addressLine2,
    this.landmark,
    this.country,
    this.location,
  });

  factory AddressModel.fromEntity(CheckoutAddress address) => AddressModel(
    fullName: address.fullName.trim(),
    email: address.email.trim().toLowerCase(),
    phone: address.phone.trim(),
    altPhone: optionalText(address.altPhone),
    addressLine1: address.addressLine1.trim(),
    addressLine2: optionalText(address.addressLine2),
    landmark: optionalText(address.landmark),
    city: address.city.trim(),
    state: address.state.trim(),
    pincode: address.pincode.trim(),
    country: optionalText(address.country),
    addressLabel: address.label.apiValue,
    location: address.location == null ? null : LocationModel.fromEntity(address.location!),
  );

  final String fullName;
  final String email;
  final String phone;
  final String? altPhone;
  final String addressLine1;
  final String? addressLine2;
  final String? landmark;
  final String city;
  final String state;
  final String pincode;
  final String? country;
  final String addressLabel;
  final LocationModel? location;

  Map<String, dynamic> toJson() => _$AddressModelToJson(this);
}
