// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'saved_address_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SavedAddressModel _$SavedAddressModelFromJson(Map<String, dynamic> json) => SavedAddressModel(
  id: SavedAddressModel._text(json['id']),
  label: SavedAddressModel._text(json['label']),
  isDefault: SavedAddressModel._flag(json['isDefault']),
  createdAt: SavedAddressModel._text(json['createdAt']),
  updatedAt: SavedAddressModel._text(json['updatedAt']),
  fullName: SavedAddressModel._text(json['fullName']),
  email: SavedAddressModel._text(json['email']),
  phone: SavedAddressModel._text(json['phone']),
  addressLine1: SavedAddressModel._text(json['addressLine1']),
  city: SavedAddressModel._text(json['city']),
  state: SavedAddressModel._text(json['state']),
  pincode: SavedAddressModel._text(json['pincode']),
  addressLine2: SavedAddressModel._textOrNull(json['addressLine2']),
  landmark: SavedAddressModel._textOrNull(json['landmark']),
  country: SavedAddressModel._textOrNull(json['country']),
  altPhone: SavedAddressModel._textOrNull(json['altPhone']),
  addressLabel: SavedAddressModel._textOrNull(json['addressLabel']),
);

Map<String, dynamic> _$SavedAddressModelToJson(SavedAddressModel instance) => <String, dynamic>{
  'id': instance.id,
  'label': instance.label,
  'isDefault': instance.isDefault,
  'createdAt': instance.createdAt,
  'updatedAt': instance.updatedAt,
  'fullName': instance.fullName,
  'email': instance.email,
  'phone': instance.phone,
  'addressLine1': instance.addressLine1,
  'addressLine2': ?instance.addressLine2,
  'landmark': ?instance.landmark,
  'city': instance.city,
  'state': instance.state,
  'pincode': instance.pincode,
  'country': ?instance.country,
  'altPhone': ?instance.altPhone,
  'addressLabel': ?instance.addressLabel,
};
