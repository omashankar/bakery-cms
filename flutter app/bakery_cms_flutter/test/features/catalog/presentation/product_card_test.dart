import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/catalog_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/delivery_area_strings.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_weight.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/product_card.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/product_rail_view.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/product_sliver_grid.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/rating_badge.dart';
import 'package:bakery_cms_flutter/features/home_layout/presentation/widgets/home_product_row.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/widgets/wishlist_heart_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import '../app_cubits_harness.dart';
import '../catalog_fixtures.dart';

/// Everything a card can draw at once: a long name, a discount (the widest
/// price row), out of stock, and a rating with a four-digit review count.
const Product _busiest = Product(
  id: 'p-busy',
  name: 'Belgian Chocolate Truffle Celebration Cake with Fresh Strawberries and Gold Leaf',
  slug: 'belgian-truffle',
  description: '',
  price: 12499,
  compareAtPrice: 15999,
  images: [],
  categoryIds: [],
  occasionIds: [],
  weights: [ProductWeight(label: '3 Kg', price: 12499)],
  shapes: [],
  flavourOptions: [],
  variantGroups: [],
  descriptionBlocks: [],
  stockStatus: StockStatus.outOfStock,
  rating: 4.6,
  reviewCount: 1234,
);

/// The tallest card: a short price and no discount, so neither one-line row
/// is shrunk, under a name long enough for both lines.
const Product _tallest = Product(
  id: 'p-tall',
  name: 'Red Velvet Pastry with Cream Cheese Frosting and White Chocolate Shavings',
  slug: 'red-velvet-tall',
  description: '',
  price: 99,
  images: [],
  categoryIds: [],
  occasionIds: [],
  weights: [],
  shapes: [],
  flavourOptions: [],
  variantGroups: [],
  descriptionBlocks: [],
  stockStatus: StockStatus.inStock,
);

void main() {
  Widget app(Widget body, {double textScale = 1, bool withConfig = true}) => withAppCubits(
    settingsLoaded: withConfig,
    MaterialApp(
      theme: AppTheme.light,
      home: Builder(
        builder: (context) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
          child: Scaffold(body: body),
        ),
      ),
    ),
  );

  Widget railCard(Product product) => Align(
    alignment: Alignment.topLeft,
    child: Builder(
      builder: (context) => SizedBox(
        width: ProductRailView.cardWidth,
        height:
            ProductRailView.cardWidth +
            MediaQuery.textScalerOf(context).scale(ProductCard.textBlockHeight),
        child: ProductCard(product: product),
      ),
    ),
  );

  group('what the card shows', () {
    testWidgets('a wishlist heart over the photo; a tap saves it and opens nothing', (
      tester,
    ) async {
      await tester.pumpWidget(app(railCard(CatalogFixtures.truffleCake)));

      final heart = find.byType(WishlistHeartButton);
      expect(heart, findsOneWidget);
      expect(
        tester.widget<WishlistHeartButton>(heart).productSlug,
        CatalogFixtures.truffleCake.slug,
      );
      // Over the photo's top-right corner.
      final photo = tester.getRect(find.byType(AspectRatio).first);
      expect(tester.getRect(heart).topRight, photo.topRight);

      await tester.tap(heart);
      await tester.pump();
      final wishlist = tester.element(find.byType(ProductCard)).read<WishlistCubit>();
      verify(() => wishlist.toggle(CatalogFixtures.truffleCake.slug)).called(1);
      // No router here: had the card's own tap fired, push would have thrown.
      expect(tester.takeException(), isNull);
    });

    testWidgets('the price row is the website\'s: price, was price and % OFF', (tester) async {
      await tester.pumpWidget(app(railCard(CatalogFixtures.truffleCake)));
      expect(find.text('₹599'), findsOneWidget);
      expect(find.text('₹699'), findsOneWidget);
      expect(find.text('14% OFF'), findsOneWidget);
      final name = tester.widget<Text>(find.text(CatalogFixtures.truffleCake.name));
      expect(name.maxLines, 2);
      // Plain, never bold.
      expect(
        name.style?.fontWeight,
        isNot(anyOf(FontWeight.w600, FontWeight.w700, FontWeight.bold)),
      );
    });

    testWidgets('the earliest delivery day, once the shop\'s settings are in', (tester) async {
      await tester.pumpWidget(app(railCard(CatalogFixtures.truffleCake)));
      expect(find.textContaining(DeliveryAreaStrings.earliestDelivery), findsOneWidget);

      // A fresh tree, so the providers make their stubs again.
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(app(railCard(CatalogFixtures.truffleCake), withConfig: false));
      expect(find.textContaining(DeliveryAreaStrings.earliestDelivery), findsNothing);
    });

    testWidgets('no rating for a product nobody has reviewed', (tester) async {
      expect(CatalogFixtures.truffleCake.reviewCount, 0);
      await tester.pumpWidget(app(railCard(CatalogFixtures.truffleCake)));
      expect(find.byType(RatingBadge), findsNothing);
      expect(find.byIcon(Icons.star), findsNothing);
    });

    testWidgets('a reviewed product shows "4.6 ★ (1234)"', (tester) async {
      await tester.pumpWidget(app(railCard(_busiest)));
      expect(find.byType(RatingBadge), findsOneWidget);
      expect(find.text('4.6'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsOneWidget);
      expect(find.text('(1234)'), findsOneWidget);
      expect(find.text(CatalogFixtures.truffleCake.name), findsNothing);
      expect(find.text(CatalogStrings.outOfStock), findsOneWidget);
    });

    testWidgets('a rating of zero reviews draws nothing even if used on its own', (tester) async {
      await tester.pumpWidget(app(const RatingBadge(rating: 4.8, reviewCount: 0)));
      expect(find.text('4.8'), findsNothing);
    });
  });

  group('nothing overflows', () {
    // The test font's letters are a full em wide, so on a phone-sized card
    // the one-line rows shrink and look shorter than they are. A card wide
    // enough that nothing shrinks shows every line at its full height: the
    // real budget [ProductCard.textBlockHeight] has to hold.
    for (final scale in [1.0, 1.3, 2.0]) {
      testWidgets('every line at full height fits the text block at text scale $scale', (
        tester,
      ) async {
        tester.view
          ..physicalSize = const Size(800, 1600)
          ..devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        const width = 760.0; // "Earliest delivery: Tomorrow" unshrunk at 2.0
        await tester.pumpWidget(
          app(
            Align(
              alignment: Alignment.topLeft,
              child: Builder(
                builder: (context) => SizedBox(
                  width: width,
                  height:
                      width + MediaQuery.textScalerOf(context).scale(ProductCard.textBlockHeight),
                  child: const ProductCard(product: _busiest),
                ),
              ),
            ),
            textScale: scale,
          ),
        );
        expect(tester.takeException(), isNull);
        // Nothing was shrunk: the delivery line is drawn at its own size.
        final delivery = find.textContaining(DeliveryAreaStrings.earliestDelivery);
        // On screen (after the FittedBox) against its own laid-out size.
        final drawn = tester.getRect(delivery).height;
        final natural = tester.renderObject<RenderBox>(delivery).size.height;
        expect(drawn, moreOrLessEquals(natural));
      });
    }

    for (final scale in [1.0, 1.3]) {
      for (final product in [_busiest, _tallest]) {
        testWidgets('a 140dp rail card at text scale $scale: ${product.slug}', (tester) async {
          await tester.pumpWidget(app(railCard(product), textScale: scale));
          expect(tester.takeException(), isNull);
          expect(find.byType(ProductCard), findsOneWidget);
        });
      }

      testWidgets('a home row and a rail at text scale $scale', (tester) async {
        await tester.pumpWidget(
          app(
            const SingleChildScrollView(
              child: HomeProductRow(products: [_busiest, _tallest, CatalogFixtures.truffleCake]),
            ),
            textScale: scale,
          ),
        );
        expect(tester.takeException(), isNull);
        expect(find.byType(ProductCard), findsWidgets);
      });

      for (final width in [320.0, 360.0]) {
        testWidgets('a two-column grid ${width.toInt()}dp wide at text scale $scale', (
          tester,
        ) async {
          tester.view
            ..physicalSize = Size(width, 1600)
            ..devicePixelRatio = 1;
          addTearDown(tester.view.reset);
          await tester.pumpWidget(
            app(
              const CustomScrollView(
                slivers: [
                  ProductSliverGrid(
                    products: [
                      _busiest,
                      _tallest,
                      CatalogFixtures.truffleCake,
                      CatalogFixtures.pastry,
                    ],
                  ),
                ],
              ),
              textScale: scale,
            ),
          );
          expect(tester.takeException(), isNull);
          // Two across, so the cards are as narrow as a phone makes them.
          final first = tester.getRect(find.byType(ProductCard).at(0));
          final second = tester.getRect(find.byType(ProductCard).at(1));
          expect(second.top, first.top);
          expect(first.width, lessThan(width / 2));
        });
      }
    }
  });
}
