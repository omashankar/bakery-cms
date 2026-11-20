// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_line_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderLineModel _$OrderLineModelFromJson(Map<String, dynamic> json) => OrderLineModel(
  productSlug: JsonReaders.string(json['productSlug']),
  name: JsonReaders.string(json['name']),
  image: JsonReaders.string(json['image']),
  price: JsonReaders.toDouble(json['price']),
  quantity: JsonReaders.toInt(json['quantity']),
  variantSummary: JsonReaders.strings(json['variantSummary']),
  weight: json['weight'] as String?,
  weightLabel: json['weightLabel'] as String?,
  flavour: json['flavour'] as String?,
  shape: json['shape'] as String?,
  message: json['message'] as String?,
);
