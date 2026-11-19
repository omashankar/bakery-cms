// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_group_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductGroupModel _$ProductGroupModelFromJson(Map<String, dynamic> json) => ProductGroupModel(
  id: JsonReaders.string(json['id']),
  name: JsonReaders.string(json['name']),
  slug: JsonReaders.string(json['slug']),
  isActive: JsonReaders.boolTrue(json['isActive']),
  image: JsonReaders.string(json['image']),
  headline: JsonReaders.string(json['headline']),
  description: JsonReaders.string(json['description']),
  productIds: JsonReaders.strings(json['productIds']),
  sortOrder: ProductGroupModel._orderOrNull(json['sortOrder']),
);
