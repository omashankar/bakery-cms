import 'package:bakery_cms_flutter/core/constants/storage_keys.dart';
import 'package:bakery_cms_flutter/core/error/cache_failure.dart';
import 'package:bakery_cms_flutter/features/cart/data/datasources/cart_local_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/cart/data/repositories/cart_repository_impl.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  const item = CartItem(
    id: 'cake|1 Kg||||base=eggless',
    productSlug: 'cake',
    name: 'Cake',
    image: 'https://example.com/cake.webp',
    unitPrice: 549,
    compareAtPrice: 699,
    quantity: 2,
    weight: '1 Kg',
    weightLabel: 'Weight',
    message: 'Happy birthday',
    variantSelections: {'base': 'eggless'},
    variantSummary: ['Eggless'],
    deliveryTierIds: ['standard'],
    codAllowed: false,
  );

  Future<CartRepositoryImpl> repository([Map<String, Object> initial = const {}]) async {
    SharedPreferences.setMockInitialValues(initial);
    return CartRepositoryImpl(CartLocalDataSourceImpl(await SharedPreferences.getInstance()));
  }

  test('a saved cart reads back identical', () async {
    final repo = await repository();
    await repo.save(const Cart([item]));
    final loaded = await repo.load();
    expect(loaded.getOrElse((_) => const Cart()), const Cart([item]));
  });

  test('nothing saved is an empty cart, not an error', () async {
    final loaded = await (await repository()).load();
    expect(loaded.getOrElse((_) => const Cart([item])), const Cart());
  });

  test('a corrupted saved cart is a CacheFailure', () async {
    final loaded = await (await repository({StorageKeys.cart: '{not json'})).load();
    expect(loaded.getLeft().toNullable(), const CacheFailure());
  });
}
