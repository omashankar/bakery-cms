import 'package:equatable/equatable.dart';

/// One basket line, as far as a coupon cares: its price, how many, and the
/// categories its product is filed under (for a coupon kept to some).
class OfferCartLine extends Equatable {
  const OfferCartLine({required this.price, required this.quantity, this.categoryIds = const []});

  final double price;
  final int quantity;
  final List<String> categoryIds;

  double get total => price * quantity;

  @override
  List<Object?> get props => [price, quantity, categoryIds];
}
