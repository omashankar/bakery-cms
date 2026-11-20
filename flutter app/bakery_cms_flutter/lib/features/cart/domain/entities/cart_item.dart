import 'package:equatable/equatable.dart';

import '../services/line_choices.dart';

/// One line in the cart: a product with the choices that make it distinct.
///
/// [unitPrice] is for display only. The shop prices the cart itself at
/// checkout (`POST /api/checkout/quote`) from the slug and choices, never
/// from this number.
class CartItem extends Equatable {
  const CartItem({
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

  /// The same product with the same choices is one line; [keyFor] builds it.
  final String id;
  final String productSlug;
  final String name;
  final String image;
  final double unitPrice;
  final double? compareAtPrice;
  final int quantity;

  /// The weight's label as the shop wrote it ("1.5 Kg"). The API matches it.
  final String? weight;

  /// What the shop calls the choice ("Weight", "Size").
  final String? weightLabel;
  final String? flavour;
  final String? shape;

  /// The message to pipe on the cake, when the product takes one.
  final String? message;

  /// The customer's photo for a photo cake, as the shop stored it.
  final String? photoUrl;

  /// A date (and time) picked for this line, as the website's cart line can
  /// carry one (`CartLineItem.deliveryDate` / `deliveryTime`). Sent with the
  /// line on the quote; the order's own slot is what the shop delivers to.
  final String? deliveryDate;
  final String? deliveryTime;

  /// Variant group id → chosen option id.
  final Map<String, String> variantSelections;

  /// "Eggless", "Heart shape": readable lines for the choices above.
  final List<String> variantSummary;

  /// The delivery speeds this product can go out at. Empty means all.
  final List<String> deliveryTierIds;

  /// Whether the product took cash on delivery when it was added.
  ///
  /// A snapshot, so checkout does NOT decide by it: it reads the live
  /// catalogue, as the website does (`codBlockedBy` in checkout-page.tsx).
  /// Only a checkout that cannot read the catalogue falls back to it.
  final bool codAllowed;

  static const int maxQuantity = 99;

  double get lineTotal => unitPrice * quantity;

  /// Every choice that makes this line, labelled ("Size: 1 Kg"), in one list:
  /// the website's `cartLineChoices`.
  List<String> get choiceSummary => LineChoices.of(
    weight: weight,
    weightLabel: weightLabel,
    flavour: flavour,
    shape: shape,
    variantSummary: variantSummary,
  );

  static String keyFor({
    required String productSlug,
    String? weight,
    String? flavour,
    String? shape,
    String? message,
    String? photoUrl,
    Map<String, String> variantSelections = const {},
  }) {
    final variants = (variantSelections.entries.toList()..sort((a, b) => a.key.compareTo(b.key)))
        .map((e) => '${e.key}=${e.value}')
        .join(',');
    // The photo is part of the line: two cakes with two different photos are
    // two lines, never one line of quantity two.
    return [
      productSlug,
      weight ?? '',
      flavour ?? '',
      shape ?? '',
      message ?? '',
      variants,
      photoUrl ?? '',
    ].join('|');
  }

  CartItem copyWith({int? quantity}) => CartItem(
    id: id,
    productSlug: productSlug,
    name: name,
    image: image,
    unitPrice: unitPrice,
    compareAtPrice: compareAtPrice,
    quantity: quantity ?? this.quantity,
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

  @override
  List<Object?> get props => [
    id,
    productSlug,
    name,
    image,
    unitPrice,
    compareAtPrice,
    quantity,
    weight,
    weightLabel,
    flavour,
    shape,
    message,
    photoUrl,
    deliveryDate,
    deliveryTime,
    variantSelections,
    variantSummary,
    deliveryTierIds,
    codAllowed,
  ];
}
