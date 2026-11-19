import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/get_wishlist_products.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../catalog/catalog_fixtures.dart';

class _MockCatalogRepository extends Mock implements CatalogRepository {}

void main() {
  late _MockCatalogRepository catalog;
  late GetWishlistProducts getWishlistProducts;

  setUp(() {
    catalog = _MockCatalogRepository();
    getWishlistProducts = GetWishlistProducts(catalog);
    when(() => catalog.getProducts()).thenAnswer(
      (_) async => const Right([
        CatalogFixtures.truffleCake,
        CatalogFixtures.pastry,
        CatalogFixtures.soldOut,
      ]),
    );
  });

  test('keeps the wishlist order, not the catalogue order', () async {
    final result = await getWishlistProducts([
      CatalogFixtures.soldOut.slug,
      CatalogFixtures.truffleCake.slug,
      CatalogFixtures.pastry.slug,
    ]);

    expect(result.getOrElse((_) => []), [
      CatalogFixtures.soldOut,
      CatalogFixtures.truffleCake,
      CatalogFixtures.pastry,
    ]);
  });

  test('silently drops a product the shop no longer publishes', () async {
    final result = await getWishlistProducts([
      'retired-cake',
      CatalogFixtures.pastry.slug,
      'another-gone',
    ]);

    expect(result.getOrElse((_) => []), [CatalogFixtures.pastry]);
  });

  test('an empty wishlist asks the catalogue for nothing', () async {
    final result = await getWishlistProducts(const []);

    expect(result.getOrElse((_) => [CatalogFixtures.pastry]), isEmpty);
    verifyNever(() => catalog.getProducts());
  });

  test('a catalogue that cannot be read is a failure, not an empty wishlist', () async {
    when(() => catalog.getProducts()).thenAnswer((_) async => const Left(NetworkFailure()));

    final result = await getWishlistProducts([CatalogFixtures.pastry.slug]);

    expect(result.getLeft().toNullable(), isA<NetworkFailure>());
  });
}
