import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_selection.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_product_by_slug.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_related_products.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_detail/product_detail_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_detail/product_detail_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../catalog_fixtures.dart';

class _MockRepository extends Mock implements CatalogRepository {}

void main() {
  const truffle = CatalogFixtures.truffleCake;
  const pastry = CatalogFixtures.pastry;
  const soldOut = CatalogFixtures.soldOut;
  const photo = CatalogFixtures.photoCake;
  const all = [soldOut, truffle, pastry, photo];

  group('the rule', () {
    test('the same category, never the product itself, in stock first', () {
      expect(GetRelatedProducts.related(photo, all), [truffle, soldOut]);
    });

    test('alone in its category: nothing', () {
      expect(GetRelatedProducts.related(pastry, all), isEmpty);
    });

    test('in no category: the same occasion instead', () {
      const loose = Product(
        id: 'p-loose',
        name: 'Gift Hamper',
        slug: 'gift-hamper',
        description: '',
        price: 999,
        images: [],
        categoryIds: [],
        occasionIds: [CatalogFixtures.birthdayId],
        weights: [],
        shapes: [],
        flavourOptions: [],
        variantGroups: [],
        descriptionBlocks: [],
        stockStatus: StockStatus.inStock,
      );
      expect(GetRelatedProducts.related(loose, [...all, loose]), [truffle]);
    });

    test('a long category is capped to one row', () {
      final many = [
        for (var i = 0; i < GetRelatedProducts.limit + 5; i++)
          Product(
            id: 'p-$i',
            name: 'Cake $i',
            slug: 'cake-$i',
            description: '',
            price: 100,
            images: const [],
            categoryIds: const [CatalogFixtures.chocolateId],
            occasionIds: const [],
            weights: const [],
            shapes: const [],
            flavourOptions: const [],
            variantGroups: const [],
            descriptionBlocks: const [],
            stockStatus: StockStatus.inStock,
          ),
      ];
      expect(GetRelatedProducts.related(photo, many), hasLength(GetRelatedProducts.limit));
    });
  });

  group('the use case', () {
    test('reads the cached product list', () async {
      final repository = _MockRepository();
      when(() => repository.getProducts()).thenAnswer((_) async => const Right(all));

      final result = await GetRelatedProducts(repository)(photo);

      expect(result.getRight().toNullable(), [truffle, soldOut]);
    });
  });

  group('the product page cubit', () {
    late _MockRepository repository;

    setUp(() {
      repository = _MockRepository();
      when(() => repository.getProducts()).thenAnswer((_) async => const Right(all));
    });

    blocTest<ProductDetailCubit, ProductDetailState>(
      'the product first, then the row under it',
      build: () => ProductDetailCubit(
        GetProductBySlug(repository),
        getRelatedProducts: GetRelatedProducts(repository),
      ),
      act: (cubit) => cubit.load(photo.slug),
      expect: () => [
        const ProductDetailState(status: ViewStatus.loading),
        ProductDetailState(status: ViewStatus.success, selection: ProductSelection.initial(photo)),
        ProductDetailState(
          status: ViewStatus.success,
          selection: ProductSelection.initial(photo),
          related: const [truffle, soldOut],
        ),
      ],
    );

    blocTest<ProductDetailCubit, ProductDetailState>(
      'no related products: no second state',
      build: () => ProductDetailCubit(
        GetProductBySlug(repository),
        getRelatedProducts: GetRelatedProducts(repository),
      ),
      act: (cubit) => cubit.load(pastry.slug),
      expect: () => [
        const ProductDetailState(status: ViewStatus.loading),
        ProductDetailState(status: ViewStatus.success, selection: ProductSelection.initial(pastry)),
      ],
    );

    blocTest<ProductDetailCubit, ProductDetailState>(
      'a failed load asks for no row',
      setUp: () => when(
        () => repository.getProducts(),
      ).thenAnswer((_) async => const Left(ServerFailure('down'))),
      build: () => ProductDetailCubit(
        GetProductBySlug(repository),
        getRelatedProducts: GetRelatedProducts(repository),
      ),
      act: (cubit) => cubit.load(photo.slug),
      expect: () => const [
        ProductDetailState(status: ViewStatus.loading),
        ProductDetailState(status: ViewStatus.failure, errorMessage: 'down'),
      ],
      verify: (_) => verify(() => repository.getProducts()).called(1),
    );
  });
}
