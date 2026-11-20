import 'package:bakery_cms_flutter/features/catalog/domain/services/product_filter.dart';
import 'package:flutter_test/flutter_test.dart';

import '../catalog_fixtures.dart';

void main() {
  const products = CatalogFixtures.products;

  test('a category holds products that list it', () {
    final found = ProductFilter.inGroup(products, CatalogFixtures.chocolate);
    expect(found.map((p) => p.slug), ['chocolate-truffle-cake', 'mango-cheesecake']);
  });

  test('an occasion holds products that list it', () {
    final found = ProductFilter.inGroup(products, CatalogFixtures.birthday);
    expect(found.map((p) => p.slug), ['chocolate-truffle-cake']);
  });

  test('a collection keeps its own order and skips missing products', () {
    final found = ProductFilter.inGroup(products, CatalogFixtures.bestsellers);
    expect(found.map((p) => p.id), ['p-pastry', 'p-truffle']);
  });

  test('search needs every word, in any case', () {
    expect(ProductFilter.search(products, 'TRUFFLE dark').map((p) => p.slug), [
      'chocolate-truffle-cake',
    ]);
    expect(ProductFilter.search(products, 'truffle mango'), isEmpty);
    expect(ProductFilter.search(products, '   '), isEmpty);
  });
}
