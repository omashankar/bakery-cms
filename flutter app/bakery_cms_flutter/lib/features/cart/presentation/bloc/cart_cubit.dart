import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/no_params.dart';
import '../../../../core/utils/view_status.dart';
import '../../domain/entities/cart.dart';
import '../../domain/entities/cart_item.dart';
import '../../domain/usecases/load_cart.dart';
import '../../domain/usecases/save_cart.dart';
import 'cart_state.dart';

/// App-wide cart. Simple state, so a Cubit: the rules for merging lines live
/// in [Cart]; this only applies them and persists the result.
class CartCubit extends Cubit<CartState> {
  CartCubit({required LoadCart loadCart, required SaveCart saveCart})
    : _loadCart = loadCart,
      _saveCart = saveCart,
      super(const CartState());

  final LoadCart _loadCart;
  final SaveCart _saveCart;

  Future<void> load() async {
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _loadCart(const NoParams());
    if (isClosed) return; // the app is closing
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (cart) => emit(state.copyWith(status: ViewStatus.success, cart: cart)),
    );
  }

  /// [announce] false skips the "added to cart" message: Buy now goes
  /// straight to the cart, where a "View cart" button only covered Checkout.
  Future<void> add(CartItem item, {bool announce = true}) =>
      _apply(state.cart.add(item), lastAddedName: announce ? item.name : null);

  Future<void> updateQuantity(String id, int quantity) =>
      _apply(state.cart.updateQuantity(id, quantity));

  Future<void> remove(String id) => _apply(state.cart.remove(id));

  /// After an order is placed.
  Future<void> clear() => _apply(const Cart());

  Future<void> _apply(Cart next, {String? lastAddedName}) async {
    emit(state.copyWith(status: ViewStatus.success, cart: next, lastAddedName: lastAddedName));
    final saved = await _saveCart(next);
    if (isClosed) return; // the app is closing
    saved.match((failure) => emit(state.copyWith(errorMessage: failure.message)), (_) {});
  }
}
