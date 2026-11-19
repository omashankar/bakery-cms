// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'checkout_product_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CheckoutProductModel _$CheckoutProductModelFromJson(Map<String, dynamic> json) =>
    CheckoutProductModel(
      slug: JsonReaders.string(json['slug']),
      status: JsonReaders.string(json['status']),
      occasionIds: JsonReaders.strings(json['occasionIds']),
      categoryId: json['categoryId'] == null ? '' : JsonReaders.string(json['categoryId']),
      categoryIds: json['categoryIds'] == null
          ? const []
          : JsonReaders.strings(json['categoryIds']),
      codAllowed: CheckoutProductModel._bool(json['codAllowed']),
      cancellationClass: CheckoutProductModel._text(json['cancellationClass']),
    );
