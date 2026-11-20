// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'product_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProductModel _$ProductModelFromJson(Map<String, dynamic> json) => ProductModel(
  id: JsonReaders.string(json['id']),
  name: JsonReaders.string(json['name']),
  slug: JsonReaders.string(json['slug']),
  description: JsonReaders.string(json['description']),
  price: JsonReaders.toDouble(json['price']),
  images: JsonReaders.strings(json['images']),
  categoryId: JsonReaders.string(json['categoryId']),
  categoryIds: JsonReaders.strings(json['categoryIds']),
  occasionIds: JsonReaders.strings(json['occasionIds']),
  deliveryTierIds: JsonReaders.strings(json['deliveryTierIds']),
  weights:
      (json['weights'] as List<dynamic>?)
          ?.map((e) => ProductWeightModel.fromJson(e as Map<String, dynamic>))
          .toList() ??
      [],
  shapes: JsonReaders.strings(json['shapes']),
  flavourOptions: JsonReaders.strings(json['flavourOptions']),
  variantGroups:
      (json['variantGroups'] as List<dynamic>?)
          ?.map((e) => VariantGroupModel.fromJson(e as Map<String, dynamic>))
          .toList() ??
      [],
  descriptionBlocks:
      (json['descriptionBlocks'] as List<dynamic>?)
          ?.map((e) => DescriptionBlockModel.fromJson(e as Map<String, dynamic>))
          .toList() ??
      [],
  status: JsonReaders.string(json['status']),
  stockStatus: JsonReaders.string(json['stockStatus']),
  isFeatured: JsonReaders.boolOr(json['isFeatured']),
  isBestSeller: JsonReaders.boolOr(json['isBestSeller']),
  isTrending: JsonReaders.boolOr(json['isTrending']),
  allowsMessage: JsonReaders.boolTrue(json['allowsMessage']),
  allowsPhotoUpload: JsonReaders.boolOr(json['allowsPhotoUpload']),
  codAllowed: JsonReaders.boolTrue(json['codAllowed']),
  rating: JsonReaders.toDouble(json['rating']),
  reviewCount: JsonReaders.toInt(json['reviewCount']),
  compareAtPrice: JsonReaders.toDoubleOrNull(json['compareAtPrice']),
  weightLabel: json['weightLabel'] as String?,
  photoFrameShape: json['photoFrameShape'] as String?,
);
