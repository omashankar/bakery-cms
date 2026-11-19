import 'package:equatable/equatable.dart';

import 'cart_item.dart';

/// The cart and the rules for changing it. Immutable: every change returns a
/// new [Cart].
class Cart extends Equatable {
  const Cart([this.items = const []]);

  final List<CartItem> items;

  bool get isEmpty => items.isEmpty;
  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);
  double get subtotal => items.fold(0, (sum, item) => sum + item.lineTotal);

  /// Cash on delivery only when every product in the cart allows it.
  bool get codAllowed => items.every((item) => item.codAllowed);

  /// Adding a line that is already in the cart adds to its quantity.
  Cart add(CartItem item) {
    final index = items.indexWhere((line) => line.id == item.id);
    if (index < 0) return Cart([...items, item]);
    final merged = (items[index].quantity + item.quantity).clamp(1, CartItem.maxQuantity);
    return Cart([
      for (final line in items) line.id == item.id ? line.copyWith(quantity: merged) : line,
    ]);
  }

  Cart updateQuantity(String id, int quantity) {
    if (quantity < 1) return remove(id);
    final clamped = quantity.clamp(1, CartItem.maxQuantity);
    return Cart([
      for (final line in items) line.id == id ? line.copyWith(quantity: clamped) : line,
    ]);
  }

  Cart remove(String id) => Cart(items.where((line) => line.id != id).toList());

  /// The tiers every product in the cart can travel at, from [tierIds] (the
  /// shop's offered tiers).
  List<String> allowedTierIds(List<String> tierIds) => tierIds
      .where(
        (tier) => items.every(
          (item) => item.deliveryTierIds.isEmpty || item.deliveryTierIds.contains(tier),
        ),
      )
      .toList();

  @override
  List<Object?> get props => [items];
}
