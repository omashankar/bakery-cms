import 'package:bakery_cms_flutter/app/router/app_routes.dart';
import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/app_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/catalog_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/listing_strings.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/catalog.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_group.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_catalog.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/categories/categories_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/pages/categories_page.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/categories_promo_banner.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/group_picture_tile.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/hero_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_banner.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_layout.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/usecases/peek_home_layout.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import '../app_cubits_harness.dart';
import '../catalog_fixtures.dart';

class _MockGetCatalog extends Mock implements GetCatalog {}

class _MockPeekHomeLayout extends Mock implements PeekHomeLayout {}

void main() {
  late _MockGetCatalog getCatalog;
  late _MockPeekHomeLayout peek;

  const promo = HomeBanner(
    imageUrl: 'https://cdn.example/diwali.jpg',
    href: '/store/occasions/birthday',
    imageAlt: 'Diwali hampers',
  );

  setUp(() {
    getCatalog = _MockGetCatalog();
    peek = _MockPeekHomeLayout();
    when(() => peek()).thenReturn(null);
    GetIt.I.registerFactory(() => CategoriesCubit(getCatalog, peekHomeLayout: peek));
  });

  tearDown(GetIt.I.reset);

  /// The tab, and a stand-in for the group page a tile opens.
  Future<void> pumpTab(WidgetTester tester, {double width = 360, double textScale = 1}) async {
    tester.view
      ..physicalSize = Size(width, 2400)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final router = GoRouter(
      initialLocation: AppRoutes.categories,
      routes: [
        GoRoute(path: AppRoutes.categories, builder: (_, _) => const CategoriesPage()),
        GoRoute(
          path: AppRoutes.groupPattern,
          builder: (_, state) =>
              Text('group ${state.pathParameters['kind']}/${state.pathParameters['slug']}'),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      withAppCubits(
        MaterialApp.router(
          theme: AppTheme.light,
          routerConfig: router,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.pump();
  }

  void givenCatalog(Catalog catalog) =>
      when(() => getCatalog(any())).thenAnswer((_) async => Right(catalog));

  testWidgets('three sections, each with its own pictures', (tester) async {
    givenCatalog(CatalogFixtures.catalog);
    await pumpTab(tester);

    expect(find.text(ListingStrings.categoriesHeading), findsOneWidget);
    expect(find.text(ListingStrings.occasionsHeading), findsOneWidget);
    expect(find.text(ListingStrings.collectionsHeading), findsOneWidget);
    expect(find.text(CatalogFixtures.chocolate.name), findsOneWidget);
    expect(find.text(CatalogFixtures.birthday.name), findsOneWidget);
    expect(find.text(CatalogFixtures.bestsellers.name), findsOneWidget);
    // In page order.
    double top(String text) => tester.getTopLeft(find.text(text)).dy;
    expect(top(ListingStrings.categoriesHeading), lessThan(top(ListingStrings.occasionsHeading)));
    expect(top(ListingStrings.occasionsHeading), lessThan(top(ListingStrings.collectionsHeading)));
    // No layout held: no banner, and none was fetched for it.
    expect(find.byType(CategoriesPromoBanner), findsNothing);
  });

  testWidgets('categories are square tiles four across; occasions larger cards', (tester) async {
    givenCatalog(
      Catalog(
        categories: [
          for (var i = 0; i < 5; i++)
            CatalogFixtures.chocolate.copyWithForTest(id: 'c$i', name: 'Category $i'),
        ],
        occasions: [
          for (var i = 0; i < 3; i++)
            CatalogFixtures.birthday.copyWithForTest(id: 'o$i', name: 'Occasion $i'),
        ],
      ),
    );
    await pumpTab(tester);

    Rect tile(String name) =>
        tester.getRect(find.ancestor(of: find.text(name), matching: find.byType(GroupPictureTile)));
    Rect picture(String name) => tester.getRect(
      find.descendant(
        of: find.ancestor(of: find.text(name), matching: find.byType(GroupPictureTile)),
        matching: find.byType(AspectRatio),
      ),
    );
    // Four in the first row, the fifth wraps.
    expect(tile('Category 3').top, tile('Category 0').top);
    expect(tile('Category 4').top, greaterThan(tile('Category 0').top));
    expect(picture('Category 0').width, picture('Category 0').height);
    // Two across, each wider than a category tile.
    expect(tile('Occasion 1').top, tile('Occasion 0').top);
    expect(tile('Occasion 2').top, greaterThan(tile('Occasion 0').top));
    expect(tile('Occasion 0').width, greaterThan(tile('Category 0').width * 1.5));
  });

  testWidgets('a tile opens its group', (tester) async {
    givenCatalog(CatalogFixtures.catalog);
    await pumpTab(tester);

    await tester.tap(find.text(CatalogFixtures.birthday.name));
    await tester.pumpAndSettle();
    expect(find.text('group occasion/birthday'), findsOneWidget);
  });

  testWidgets('the home page\'s promo picture leads, and opens what it links to', (tester) async {
    when(() => peek()).thenReturn(
      const HomeLayout(
        sections: [
          HeroSection(id: 'hero', slides: [promo]),
        ],
      ),
    );
    givenCatalog(CatalogFixtures.catalog);
    await pumpTab(tester);

    final banner = find.byType(CategoriesPromoBanner);
    expect(banner, findsOneWidget);
    expect(
      tester.getTopLeft(banner).dy,
      lessThan(tester.getTopLeft(find.text(ListingStrings.categoriesHeading)).dy),
    );
    await tester.tap(banner);
    await tester.pumpAndSettle();
    expect(find.text('group occasion/birthday'), findsOneWidget);
  });

  testWidgets('a shop with no groups says so', (tester) async {
    givenCatalog(const Catalog());
    await pumpTab(tester);
    expect(find.text(CatalogStrings.noCategories), findsOneWidget);
  });

  testWidgets('a failed load offers a retry that asks again', (tester) async {
    when(() => getCatalog(any())).thenAnswer((_) async => const Left(NetworkFailure()));
    await pumpTab(tester);
    expect(find.text(const NetworkFailure().message), findsOneWidget);

    givenCatalog(CatalogFixtures.catalog);
    await tester.tap(find.text(AppStrings.retry));
    await tester.pump();
    await tester.pump();
    verify(() => getCatalog(true)).called(1);
    expect(find.text(CatalogFixtures.chocolate.name), findsOneWidget);
  });

  for (final width in [320.0, 360.0]) {
    testWidgets('nothing overflows ${width.toInt()}dp wide at text scale 1.3', (tester) async {
      givenCatalog(
        CatalogFixtures.catalog.copyWithForTest(
          longName: 'Eggless Chocolate Truffle and Hazelnut Celebration Cakes',
        ),
      );
      await pumpTab(tester, width: width, textScale: 1.3);
      expect(tester.takeException(), isNull);
    });
  }
}

extension on Catalog {
  /// Every group renamed to [longName], to fill each tile's name lines.
  Catalog copyWithForTest({required String longName}) => Catalog(
    categories: [for (final g in categories) g.copyWithForTest(id: g.id, name: longName)],
    occasions: [for (final g in occasions) g.copyWithForTest(id: g.id, name: longName)],
    collections: [for (final g in collections) g.copyWithForTest(id: g.id, name: longName)],
  );
}

extension on ProductGroup {
  ProductGroup copyWithForTest({required String id, required String name}) =>
      ProductGroup(id: id, name: name, slug: id, kind: kind, image: image);
}
