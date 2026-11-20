import '../models/cart_item_model.dart';

abstract interface class CartLocalDataSource {
  /// Throws `CacheException` when the saved cart cannot be read.
  Future<List<CartItemModel>> read();

  Future<void> write(List<CartItemModel> items);
}
