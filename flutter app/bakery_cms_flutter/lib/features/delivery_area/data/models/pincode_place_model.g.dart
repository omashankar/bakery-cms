// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pincode_place_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PincodePlaceModel _$PincodePlaceModelFromJson(Map<String, dynamic> json) => PincodePlaceModel(
  pincode: JsonReaders.string(json['pincode']),
  state: JsonReaders.string(json['state']),
  districts: json['districts'] == null ? const [] : JsonReaders.strings(json['districts']),
  areas: json['areas'] == null ? const [] : JsonReaders.strings(json['areas']),
);
