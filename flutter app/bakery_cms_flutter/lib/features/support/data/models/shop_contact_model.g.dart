// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'shop_contact_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ShopContactModel _$ShopContactModelFromJson(Map<String, dynamic> json) => ShopContactModel(
  address: JsonReaders.string(json['address']),
  phone: JsonReaders.string(json['phone']),
  email: JsonReaders.string(json['email']),
  businessHours: ShopContactModel._hours(json['businessHours']),
);
