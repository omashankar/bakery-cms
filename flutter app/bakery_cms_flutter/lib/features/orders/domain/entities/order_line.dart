import 'package:equatable/equatable.dart';

class OrderLine extends Equatable {
  const OrderLine({
    required this.productSlug,
    required this.name,
    required this.image,
    required this.price,
    required this.quantity,
    this.choices = const [],
    this.message,
  });

  final String productSlug;
  final String name;
  final String image;

  /// The unit price the shop charged.
  final double price;
  final int quantity;

  /// Weight, flavour, shape and variant lines, readable.
  final List<String> choices;
  final String? message;

  double get lineTotal => price * quantity;

  @override
  List<Object?> get props => [productSlug, name, image, price, quantity, choices, message];
}
