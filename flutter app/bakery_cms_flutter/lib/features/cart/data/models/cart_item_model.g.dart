// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'cart_item_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CartItemModel _$CartItemModelFromJson(Map<String, dynamic> json) => CartItemModel(
  id: JsonReaders.string(json['id']),
  productSlug: JsonReaders.string(json['productSlug']),
  name: JsonReaders.string(json['name']),
  image: JsonReaders.string(json['image']),
  unitPrice: JsonReaders.toDouble(json['unitPrice']),
  quantity: JsonReaders.toInt(json['quantity']),
  compareAtPrice: JsonReaders.toDoubleOrNull(json['compareAtPrice']),
  weight: json['weight'] as String?,
  weightLabel: json['weightLabel'] as String?,
  flavour: json['flavour'] as String?,
  shape: json['shape'] as String?,
  message: json['message'] as String?,
  photoUrl: json['photoUrl'] as String?,
  deliveryDate: json['deliveryDate'] as String?,
  deliveryTime: json['deliveryTime'] as String?,
  variantSelections: json['variantSelections'] == null
      ? const {}
      : JsonReaders.stringMap(json['variantSelections']),
  variantSummary: json['variantSummary'] == null
      ? const []
      : JsonReaders.strings(json['variantSummary']),
  deliveryTierIds: json['deliveryTierIds'] == null
      ? const []
      : JsonReaders.strings(json['deliveryTierIds']),
  codAllowed: json['codAllowed'] == null ? true : JsonReaders.boolTrue(json['codAllowed']),
);

Map<String, dynamic> _$CartItemModelToJson(CartItemModel instance) => <String, dynamic>{
  'id': instance.id,
  'productSlug': instance.productSlug,
  'name': instance.name,
  'image': instance.image,
  'unitPrice': instance.unitPrice,
  'compareAtPrice': ?instance.compareAtPrice,
  'quantity': instance.quantity,
  'weight': ?instance.weight,
  'weightLabel': ?instance.weightLabel,
  'flavour': ?instance.flavour,
  'shape': ?instance.shape,
  'message': ?instance.message,
  'photoUrl': ?instance.photoUrl,
  'deliveryDate': ?instance.deliveryDate,
  'deliveryTime': ?instance.deliveryTime,
  'variantSelections': instance.variantSelections,
  'variantSummary': instance.variantSummary,
  'deliveryTierIds': instance.deliveryTierIds,
  'codAllowed': instance.codAllowed,
};
