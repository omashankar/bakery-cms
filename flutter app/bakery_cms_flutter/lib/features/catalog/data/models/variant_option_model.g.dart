// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'variant_option_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VariantOptionModel _$VariantOptionModelFromJson(Map<String, dynamic> json) => VariantOptionModel(
  id: JsonReaders.string(json['id']),
  label: JsonReaders.string(json['label']),
  priceAdjustment: JsonReaders.toDouble(json['priceAdjustment']),
  isDefault: JsonReaders.boolOr(json['isDefault']),
);
