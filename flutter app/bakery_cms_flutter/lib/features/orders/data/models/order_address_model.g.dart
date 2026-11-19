// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_address_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderAddressModel _$OrderAddressModelFromJson(Map<String, dynamic> json) => OrderAddressModel(
  fullName: JsonReaders.string(json['fullName']),
  email: JsonReaders.string(json['email']),
  phone: JsonReaders.string(json['phone']),
  addressLine1: JsonReaders.string(json['addressLine1']),
  city: JsonReaders.string(json['city']),
  state: JsonReaders.string(json['state']),
  pincode: JsonReaders.string(json['pincode']),
  addressLine2: json['addressLine2'] as String?,
  landmark: json['landmark'] as String?,
  addressLabel: json['addressLabel'] as String?,
);
