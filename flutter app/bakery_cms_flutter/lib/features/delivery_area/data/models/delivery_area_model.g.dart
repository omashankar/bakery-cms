// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'delivery_area_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DeliveryAreaModel _$DeliveryAreaModelFromJson(Map<String, dynamic> json) => DeliveryAreaModel(
  pincode: JsonReaders.string(json['pincode']),
  status: JsonReaders.string(json['status']),
  city: json['city'] == null ? '' : JsonReaders.string(json['city']),
  state: json['state'] == null ? '' : JsonReaders.string(json['state']),
  charge: JsonReaders.toDoubleOrNull(json['charge']),
  minDeliveryDays: DeliveryAreaModel._days(json['minDeliveryDays']),
  freeDeliveryThreshold: JsonReaders.toDoubleOrNull(json['freeDeliveryThreshold']),
  priceMayVary: json['priceMayVary'] == null ? false : JsonReaders.boolOr(json['priceMayVary']),
  required: json['required'] == null ? true : JsonReaders.boolTrue(json['required']),
);

Map<String, dynamic> _$DeliveryAreaModelToJson(DeliveryAreaModel instance) => <String, dynamic>{
  'pincode': instance.pincode,
  'status': instance.status,
  'city': instance.city,
  'state': instance.state,
  'charge': ?instance.charge,
  'minDeliveryDays': ?instance.minDeliveryDays,
  'freeDeliveryThreshold': ?instance.freeDeliveryThreshold,
  'priceMayVary': instance.priceMayVary,
  'required': instance.required,
};
