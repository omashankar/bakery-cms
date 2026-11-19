// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'variant_group_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VariantGroupModel _$VariantGroupModelFromJson(Map<String, dynamic> json) => VariantGroupModel(
  id: JsonReaders.string(json['id']),
  name: JsonReaders.string(json['name']),
  required: JsonReaders.boolOr(json['required']),
  options:
      (json['options'] as List<dynamic>?)
          ?.map((e) => VariantOptionModel.fromJson(e as Map<String, dynamic>))
          .toList() ??
      [],
  type: JsonReaders.string(json['type']),
);
