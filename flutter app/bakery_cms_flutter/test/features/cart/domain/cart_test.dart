import 'package:bakery_cms_flutter/features/cart/domain/entities/cart.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:flutter_test/flutter_test.dart';

CartItem line({
  String slug = 'cake',
  String? weight = '1 Kg',
  int quantity = 1,
  double price = 500,
  List<String> tiers = const [],
  bool cod = true,
}) {
  return CartItem(
    id: CartItem.keyFor(productSlug: slug, weight: weight),
    productSlug: slug,
    name: slug,
    image: '',
    unitPrice: price,
    quantity: quantity,
    weight: weight,
    deliveryTierIds: tiers,
    codAllowed: cod,
  );
}

void main() {
  group('Cart', () {
    test('adding the same product with the same choices merges the lines', () {
      final cart = const Cart().add(line(quantity: 2)).add(line(quantity: 3));
      expect(cart.items, hasLength(1));
      expect(cart.items.single.quantity, 5);
    });

    test('a different weight is a different line', () {
      final cart = const Cart().add(line()).add(line(weight: '2 Kg'));
      expect(cart.items, hasLength(2));
    });

    test('a merge never goes past the API limit of 99', () {
      final cart = const Cart().add(line(quantity: 90)).add(line(quantity: 20));
      expect(cart.items.single.quantity, CartItem.maxQuantity);
    });

    test('quantity below 1 removes the line', () {
      final item = line();
      final cart = Cart([item]).updateQuantity(item.id, 0);
      expect(cart.isEmpty, isTrue);
    });

    test('totals', () {
      final cart = Cart([line(quantity: 2, price: 300), line(slug: 'b', price: 100)]);
      expect(cart.itemCount, 3);
      expect(cart.subtotal, 700);
    });

    test('COD only when every product allows it', () {
      expect(Cart([line(), line(slug: 'b')]).codAllowed, isTrue);
      expect(Cart([line(), line(slug: 'b', cod: false)]).codAllowed, isFalse);
    });

    test('allowed tiers are those every product can travel at', () {
      final cart = Cart([
        line(tiers: ['standard', 'midnight']),
        line(slug: 'b', tiers: ['standard']),
        line(slug: 'c'), // no restriction
      ]);
      expect(cart.allowedTierIds(['standard', 'fixed-time', 'midnight']), ['standard']);
    });
  });

  test('keyFor ignores the order of variant selections', () {
    final a = CartItem.keyFor(productSlug: 'x', variantSelections: {'a': '1', 'b': '2'});
    final b = CartItem.keyFor(productSlug: 'x', variantSelections: {'b': '2', 'a': '1'});
    expect(a, b);
  });
}
