import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/group_kind.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/group_listing.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_group_listing.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/group_listing_params.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/categories/categories_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/categories/categories_state.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_catalog.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_list/product_list_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_list/product_list_state.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/banners_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/banner_layout.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_banner.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_layout.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/usecases/peek_home_layout.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../catalog_fixtures.dart';

class _MockGetGroupListing extends Mock implements GetGroupListing {}

class _MockGetCatalog extends Mock implements GetCatalog {}

class _MockPeekHomeLayout extends Mock implements PeekHomeLayout {}

void main() {
  group('ProductListCubit', () {
    late _MockGetGroupListing getListing;
    const params = GroupListingParams(kind: GroupKind.category, slug: 'chocolate-cakes');
    const listing = GroupListing(
      group: CatalogFixtures.chocolate,
      products: [CatalogFixtures.truffleCake],
    );

    setUp(() => getListing = _MockGetGroupListing());

    blocTest<ProductListCubit, ProductListState>(
      'loads the group and its products',
      setUp: () => when(() => getListing(params)).thenAnswer((_) async => const Right(listing)),
      build: () => ProductListCubit(getListing),
      act: (cubit) => cubit.load(GroupKind.category, 'chocolate-cakes'),
      expect: () => const [
        ProductListState(status: ViewStatus.loading),
        ProductListState(status: ViewStatus.success, listing: listing),
      ],
    );

    blocTest<ProductListCubit, ProductListState>(
      'refresh refetches the same group, forcing the network',
      setUp: () {
        when(() => getListing(params)).thenAnswer((_) async => const Right(listing));
        when(
          () => getListing(
            const GroupListingParams(
              kind: GroupKind.category,
              slug: 'chocolate-cakes',
              forceRefresh: true,
            ),
          ),
        ).thenAnswer((_) async => const Left(NetworkFailure()));
      },
      build: () => ProductListCubit(getListing),
      act: (cubit) async {
        await cubit.load(GroupKind.category, 'chocolate-cakes');
        await cubit.refresh();
      },
      skip: 2,
      expect: () => [
        const ProductListState(status: ViewStatus.loading, listing: listing),
        ProductListState(
          status: ViewStatus.failure,
          listing: listing,
          errorMessage: const NetworkFailure().message,
        ),
      ],
    );
  });

  group('CategoriesCubit', () {
    late _MockGetCatalog getCatalog;
    late _MockPeekHomeLayout peek;
    const promo = HomeBanner(
      imageUrl: 'https://cdn.example/promo.jpg',
      href: '/store/occasions/birthday',
    );
    const layout = HomeLayout(
      sections: [
        BannersSection(id: 'promos', layout: BannerLayout.grid, items: [promo]),
      ],
    );
    setUp(() {
      getCatalog = _MockGetCatalog();
      peek = _MockPeekHomeLayout();
      when(() => peek()).thenReturn(null);
    });

    blocTest<CategoriesCubit, CategoriesState>(
      'loads the catalog',
      setUp: () => when(
        () => getCatalog(false),
      ).thenAnswer((_) async => const Right(CatalogFixtures.catalog)),
      build: () => CategoriesCubit(getCatalog, peekHomeLayout: peek),
      act: (cubit) => cubit.load(),
      expect: () => const [
        CategoriesState(status: ViewStatus.loading),
        CategoriesState(status: ViewStatus.success, catalog: CatalogFixtures.catalog),
      ],
    );

    blocTest<CategoriesCubit, CategoriesState>(
      "borrows the home page's promo picture when the app already holds the layout",
      setUp: () {
        when(() => peek()).thenReturn(layout);
        when(() => getCatalog(false)).thenAnswer((_) async => const Right(CatalogFixtures.catalog));
      },
      build: () => CategoriesCubit(getCatalog, peekHomeLayout: peek),
      act: (cubit) => cubit.load(),
      expect: () => const [
        CategoriesState(status: ViewStatus.loading),
        CategoriesState(status: ViewStatus.success, catalog: CatalogFixtures.catalog, promo: promo),
      ],
      // Read from memory only: never a request of its own.
      verify: (_) => verify(() => peek()).called(1),
    );

    blocTest<CategoriesCubit, CategoriesState>(
      'a failed load still says what went wrong, and keeps no stale promo',
      setUp: () =>
          when(() => getCatalog(true)).thenAnswer((_) async => const Left(NetworkFailure())),
      build: () => CategoriesCubit(getCatalog, peekHomeLayout: peek),
      seed: () => const CategoriesState(status: ViewStatus.success, promo: promo),
      act: (cubit) => cubit.load(forceRefresh: true),
      expect: () => [
        const CategoriesState(status: ViewStatus.loading, promo: promo),
        CategoriesState(status: ViewStatus.failure, errorMessage: const NetworkFailure().message),
      ],
    );
  });
}
