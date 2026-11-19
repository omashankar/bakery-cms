// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'delivery_tier_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DeliveryTierModel _$DeliveryTierModelFromJson(Map<String, dynamic> json) => DeliveryTierModel(
  id: JsonReaders.string(json['id']),
  label: JsonReaders.string(json['label']),
  description: JsonReaders.string(json['description']),
  fee: JsonReaders.toDouble(json['fee']),
  windows: JsonReaders.strings(json['windows']),
);
