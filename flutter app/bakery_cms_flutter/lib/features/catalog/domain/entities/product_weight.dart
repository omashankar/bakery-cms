import 'package:equatable/equatable.dart';

/// A size the product is sold in, at its own full price (not a surcharge).
class ProductWeight extends Equatable {
  const ProductWeight({required this.label, required this.price, this.serves});

  final String label;
  final double price;

  /// "Serves 8–10", when the shop wrote one.
  final String? serves;

  @override
  List<Object?> get props => [label, price, serves];
}
