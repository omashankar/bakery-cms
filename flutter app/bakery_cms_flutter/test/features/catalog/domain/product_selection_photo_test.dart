import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_selection.dart';
import 'package:flutter_test/flutter_test.dart';

import '../catalog_fixtures.dart';

void main() {
  const url = CatalogFixtures.photoUrl;
  final plain = ProductSelection.initial(CatalogFixtures.photoCake);

  test('the uploaded photo goes into the cart line', () {
    final item = plain.withPhoto(url).toCartItem();

    expect(item.photoUrl, url);
  });

  test('two photos are two cart lines, and no photo is a third', () {
    final first = plain.withPhoto(url).toCartItem();
    final second = plain.withPhoto('$url?v=2').toCartItem();
    final none = plain.toCartItem();

    expect({first.id, second.id, none.id}, hasLength(3));
  });

  test('keyFor counts the photo', () {
    expect(
      CartItem.keyFor(productSlug: 'photo-cake', photoUrl: url),
      isNot(CartItem.keyFor(productSlug: 'photo-cake')),
    );
  });

  test('withPhoto(null) takes the photo off', () {
    expect(plain.withPhoto(url).withPhoto(null).photoUrl, isNull);
  });

  test('other choices keep the photo', () {
    final changed = plain.withPhoto(url).copyWith(quantity: 3, message: 'Happy birthday');

    expect(changed.photoUrl, url);
    expect(changed.toCartItem().photoUrl, url);
  });

  test('a product that takes no photo never carries one', () {
    final cake = ProductSelection.initial(CatalogFixtures.truffleCake).withPhoto(url);

    expect(cake.photoUrl, isNull);
    expect(cake.toCartItem().photoUrl, isNull);
  });

  test('the photo survives a quantity change in the cart', () {
    final item = plain.withPhoto(url).toCartItem().copyWith(quantity: 2);

    expect(item.photoUrl, url);
  });
}
