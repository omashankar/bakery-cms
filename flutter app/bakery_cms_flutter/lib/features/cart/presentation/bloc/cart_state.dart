import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/cart.dart';

class CartState extends Equatable {
  const CartState({
    this.status = ViewStatus.initial,
    this.cart = const Cart(),
    this.errorMessage,
    this.lastAddedName,
  });

  final ViewStatus status;
  final Cart cart;

  /// Set when loading or saving failed; shown once by a listener.
  final String? errorMessage;

  /// The product just added, so a listener can say "Added to cart".
  final String? lastAddedName;

  CartState copyWith({
    ViewStatus? status,
    Cart? cart,
    String? errorMessage,
    String? lastAddedName,
  }) {
    return CartState(
      status: status ?? this.status,
      cart: cart ?? this.cart,
      errorMessage: errorMessage,
      lastAddedName: lastAddedName,
    );
  }

  @override
  List<Object?> get props => [status, cart, errorMessage, lastAddedName];
}
