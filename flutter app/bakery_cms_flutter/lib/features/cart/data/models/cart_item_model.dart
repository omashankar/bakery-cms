import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/cart_item.dart';

part 'cart_item_model.g.dart';

/// A cart line as stored on the device.
@JsonSerializable(includeIfNull: false)
class CartItemModel {
  const CartItemModel({
    required this.id,
    required this.productSlug,
    required this.name,
    required this.image,
    required this.unitPrice,
    required this.quantity,
    this.compareAtPrice,
    this.weight,
    this.weightLabel,
    this.flavour,
    this.shape,
    this.message,
    this.photoUrl,
    this.deliveryDate,
    this.deliveryTime,
    this.variantSelections = const {},
    this.variantSummary = const [],
    this.deliveryTierIds = const [],
    this.codAllowed = true,
  });

  factory CartItemModel.fromJson(Map<String, dynamic> json) => _$CartItemModelFromJson(json);

  factory CartItemModel.fromEntity(CartItem item) => CartItemModel(
    id: item.id,
    productSlug: item.productSlug,
    name: item.name,
    image: item.image,
    unitPrice: item.unitPrice,
    compareAtPrice: item.compareAtPrice,
    quantity: item.quantity,
    weight: item.weight,
    weightLabel: item.weightLabel,
    flavour: item.flavour,
    shape: item.shape,
    message: item.message,
    photoUrl: item.photoUrl,
    deliveryDate: item.deliveryDate,
    deliveryTime: item.deliveryTime,
    variantSelections: item.variantSelections,
    variantSummary: item.variantSummary,
    deliveryTierIds: item.deliveryTierIds,
    codAllowed: item.codAllowed,
  );

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String productSlug;
  @JsonKey(fromJson: JsonReaders.string)
  final String name;
  @JsonKey(fromJson: JsonReaders.string)
  final String image;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double unitPrice;
  @JsonKey(fromJson: JsonReaders.toDoubleOrNull)
  final double? compareAtPrice;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int quantity;
  final String? weight;
  final String? weightLabel;
  final String? flavour;
  final String? shape;
  final String? message;
  final String? photoUrl;
  final String? deliveryDate;
  final String? deliveryTime;
  @JsonKey(fromJson: JsonReaders.stringMap)
  final Map<String, String> variantSelections;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> variantSummary;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> deliveryTierIds;
  @JsonKey(fromJson: JsonReaders.boolTrue)
  final bool codAllowed;

  Map<String, dynamic> toJson() => _$CartItemModelToJson(this);

  CartItem toEntity() => CartItem(
    id: id,
    productSlug: productSlug,
    name: name,
    image: image,
    unitPrice: unitPrice,
    compareAtPrice: compareAtPrice,
    quantity: quantity.clamp(1, CartItem.maxQuantity),
    weight: weight,
    weightLabel: weightLabel,
    flavour: flavour,
    shape: shape,
    message: message,
    photoUrl: photoUrl,
    deliveryDate: deliveryDate,
    deliveryTime: deliveryTime,
    variantSelections: variantSelections,
    variantSummary: variantSummary,
    deliveryTierIds: deliveryTierIds,
    codAllowed: codAllowed,
  );
}
