import 'package:json_annotation/json_annotation.dart';

import '../../../cart/domain/entities/cart_item.dart';
import 'optional_text.dart';

part 'order_line_model.g.dart';

/// A cart line in the order body. Its price is ignored when a draft is sent;
/// the schema still requires one.
@JsonSerializable(createFactory: false, includeIfNull: false)
class OrderLineModel {
  const OrderLineModel({
    required this.productSlug,
    required this.name,
    required this.image,
    required this.price,
    required this.quantity,
    this.weight,
    this.flavour,
    this.shape,
    this.message,
    this.photoUrl,
    this.deliveryDate,
    this.deliveryTime,
    this.variantSelections,
  });

  factory OrderLineModel.fromEntity(CartItem item) => OrderLineModel(
    productSlug: item.productSlug,
    name: item.name,
    image: item.image,
    price: item.unitPrice,
    quantity: item.quantity,
    weight: optionalText(item.weight),
    flavour: optionalText(item.flavour),
    shape: optionalText(item.shape),
    message: optionalText(item.message),
    photoUrl: optionalText(item.photoUrl),
    deliveryDate: optionalText(item.deliveryDate),
    deliveryTime: optionalText(item.deliveryTime),
    variantSelections: item.variantSelections.isEmpty ? null : item.variantSelections,
  );

  final String productSlug;
  final String name;
  final String image;
  final double price;
  final int quantity;
  final String? weight;
  final String? flavour;
  final String? shape;
  final String? message;

  /// The photo-cake picture this shop's upload stored (checked server-side).
  final String? photoUrl;

  /// The line's own date and time, when it carries one (the website sends
  /// both on every line: `requestCartQuote` in quote-api.ts).
  final String? deliveryDate;
  final String? deliveryTime;
  final Map<String, String>? variantSelections;

  Map<String, dynamic> toJson() => _$OrderLineModelToJson(this);
}
