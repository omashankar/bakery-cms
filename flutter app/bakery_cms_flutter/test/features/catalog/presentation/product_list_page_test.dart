import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/catalog_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/delivery_area_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/listing_strings.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/group_kind.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/group_listing.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_group.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_weight.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_group.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_option.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_group_listing.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/group_listing_params.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/listing_controls/listing_controls_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_list/product_list_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/pages/product_list_page.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/product_card.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/shop_title.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/payment_methods.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_modules.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';

import '../app_cubits_harness.dart';
import '../catalog_fixtures.dart';

class _MockGetGroupListing extends Mock implements GetGroupListing {}

const ProductGroup _group = ProductGroup(
  id: CatalogFixtures.chocolateId,
  name: 'Chocolate Cakes',
  slug: 'chocolate-cakes',
  kind: GroupKind.category,
  headline: 'Dark, rich and baked fresh every morning',
);

/// Rated, so "4★ & above" has something to keep.
const Product _rated = Product(
  id: 'p-rated',
  name: 'Hazelnut Rocher Cake',
  slug: 'hazelnut-rocher',
  description: '',
  price: 2400,
  images: [],
  categoryIds: [CatalogFixtures.chocolateId],
  occasionIds: [],
  weights: [],
  shapes: [],
  flavourOptions: [],
  variantGroups: [],
  descriptionBlocks: [],
  stockStatus: StockStatus.inStock,
  rating: 4.7,
  reviewCount: 9,
);

/// ₹900 at its first size with a default Heart shape at +₹200: ₹1,100 where
/// shapes are sold, ₹900 where the shop switched Shape off.
const Product _shaped = Product(
  id: 'p-shaped',
  name: 'Heart Truffle Cake',
  slug: 'heart-truffle',
  description: '',
  price: 700,
  images: [],
  categoryIds: [CatalogFixtures.chocolateId],
  occasionIds: [],
  weights: [ProductWeight(label: '1 Kg', price: 900)],
  shapes: [],
  flavourOptions: [],
  variantGroups: [
    VariantGroup(
      id: 'shape',
      name: 'Shape',
      required: true,
      type: VariantGroup.shape,
      options: [VariantOption(id: 'heart', label: 'Heart', priceAdjustment: 200, isDefault: true)],
    ),
  ],
  descriptionBlocks: [],
  stockStatus: StockStatus.inStock,
);

const Product _flat = Product(
  id: 'p-flat',
  name: 'Plain Sponge Cake',
  slug: 'plain-sponge',
  description: '',
  price: 1000,
  images: [],
  categoryIds: [CatalogFixtures.chocolateId],
  occasionIds: [],
  weights: [],
  shapes: [],
  flavourOptions: [],
  variantGroups: [],
  descriptionBlocks: [],
  stockStatus: StockStatus.inStock,
);

/// A shop that has switched Shape (and Weight) off.
StoreConfig _shapeOff() => const StoreConfig(
  siteName: 'Sweet Crumbs Bakery',
  tagline: '',
  logoUrl: '',
  currency: 'INR',
  deliveryFee: 99,
  freeDeliveryThreshold: 999,
  minOrderValue: 0,
  useZoneBasedDelivery: true,
  deliveryLeadDays: 0,
  sameDayCutoff: '14:00',
  deliveryTimeSlots: [],
  deliveryTiers: [],
  giftWrapEnabled: false,
  giftWrapFee: 0,
  giftWrapLabel: '',
  checkoutTerms: '',
  paymentMethods: PaymentMethods(cod: true, upi: true, card: true, razorpay: true),
  maintenanceEnabled: false,
  maintenanceMessage: '',
  modules: {StoreModules.shape: false, StoreModules.weight: false},
);

void main() {
  late _MockGetGroupListing getListing;

  setUpAll(
    () => registerFallbackValue(const GroupListingParams(kind: GroupKind.category, slug: '')),
  );

  setUp(() {
    getListing = _MockGetGroupListing();
    GetIt.I
      ..registerFactory(() => ProductListCubit(getListing))
      ..registerFactory(ListingControlsCubit.new);
  });

  tearDown(GetIt.I.reset);

  Future<void> pumpPage(
    WidgetTester tester,
    List<Product> products, {
    StoreConfig? settings,
  }) async {
    when(
      () => getListing(any()),
    ).thenAnswer((_) async => Right(GroupListing(group: _group, products: products)));
    tester.view
      ..physicalSize = const Size(360, 2400)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      withAppCubits(
        settings: settings,
        MaterialApp(
          theme: AppTheme.light,
          home: const ProductListPage(kind: GroupKind.category, slug: 'chocolate-cakes'),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  List<String> shown(WidgetTester tester) => [
    for (final card in tester.widgetList<ProductCard>(find.byType(ProductCard))) card.product.slug,
  ];

  // Catalogue order: truffle (₹599, best seller), pastry (₹149), sold out (₹899).
  const products = CatalogFixtures.products;
  final popularity = ['chocolate-truffle-cake', 'red-velvet-pastry', 'mango-cheesecake'];

  testWidgets('delivery bar, the group, its line, the count and the bottom bar', (tester) async {
    await pumpPage(tester, products);

    expect(find.text(DeliveryAreaStrings.addPincode), findsOneWidget);
    // The header carries the shop's brand, as on every page; the group's
    // name is the page's own heading, once.
    final header = find.byType(AppBar);
    expect(find.descendant(of: header, matching: find.byType(ShopTitle)), findsOneWidget);
    expect(find.descendant(of: header, matching: find.text(_group.name)), findsNothing);
    expect(find.text(_group.name), findsOneWidget);
    expect(find.text(_group.headline), findsOneWidget);
    expect(find.text(ListingStrings.productCount(3)), findsOneWidget);
    expect(find.text('Sort by · Popularity'), findsOneWidget);
    expect(find.text(ListingStrings.filter), findsOneWidget);
    expect(shown(tester), popularity);
    // The delivery bar sits above the page's own content.
    expect(
      tester.getTopLeft(find.text(DeliveryAreaStrings.addPincode)).dy,
      lessThan(tester.getTopLeft(find.text(_group.headline)).dy),
    );
  });

  testWidgets('Sort by opens its sheet; a choice reorders the grid and names itself', (
    tester,
  ) async {
    await pumpPage(tester, products);

    await tester.tap(find.text('Sort by · Popularity'));
    await tester.pumpAndSettle();
    expect(find.text(ListingStrings.sortPriceLowToHigh), findsOneWidget);
    expect(find.text(ListingStrings.sortPriceHighToLow), findsOneWidget);
    // Popularity, ticked, is named in the bar behind the sheet and in it.
    expect(find.text(ListingStrings.sortPopularity), findsOneWidget);

    await tester.tap(find.text(ListingStrings.sortPriceHighToLow));
    await tester.pumpAndSettle();
    expect(find.text(ListingStrings.sortPriceLowToHigh), findsNothing); // closed
    expect(find.text('Sort by · Price: high to low'), findsOneWidget);
    expect(shown(tester), ['mango-cheesecake', 'chocolate-truffle-cake', 'red-velvet-pastry']);

    await tester.tap(find.text('Sort by · Price: high to low'));
    await tester.pumpAndSettle();
    await tester.tap(find.text(ListingStrings.sortPriceLowToHigh));
    await tester.pumpAndSettle();
    expect(shown(tester), ['red-velvet-pastry', 'chocolate-truffle-cake', 'mango-cheesecake']);
  });

  testWidgets('Filter: ticks apply on Apply, and the bar counts them', (tester) async {
    await pumpPage(tester, products);

    await tester.tap(find.text(ListingStrings.filter));
    await tester.pumpAndSettle();
    expect(find.text('Under ₹500'), findsOneWidget);
    expect(find.text('₹500 – ₹1,000'), findsOneWidget);
    expect(find.text('₹1,000 – ₹2,000'), findsOneWidget);
    expect(find.text('Above ₹2,000'), findsOneWidget);
    // Nothing here has a review: no rating filter to offer.
    expect(find.text(ListingStrings.fourStarAndAbove), findsNothing);

    await tester.tap(find.text(ListingStrings.inStockOnly));
    await tester.tap(find.text('₹500 – ₹1,000'));
    await tester.pump();
    // A draft: the grid behind is untouched until Apply.
    expect(shown(tester), popularity);

    await tester.tap(find.text(ListingStrings.apply));
    await tester.pumpAndSettle();
    expect(find.text(ListingStrings.apply), findsNothing);
    expect(find.text('Filter (2)'), findsOneWidget);
    expect(shown(tester), ['chocolate-truffle-cake']);
    expect(find.text(ListingStrings.productCount(1)), findsOneWidget);
  });

  testWidgets('closing the sheet without Apply changes nothing', (tester) async {
    await pumpPage(tester, products);

    await tester.tap(find.text(ListingStrings.filter));
    await tester.pumpAndSettle();
    await tester.tap(find.text(ListingStrings.inStockOnly));
    await tester.pump();
    await tester.tapAt(const Offset(180, 20)); // the scrim above the sheet
    await tester.pumpAndSettle();

    expect(find.text(ListingStrings.filter), findsOneWidget);
    expect(shown(tester), popularity);
  });

  testWidgets('the rating filter is offered once a product has reviews', (tester) async {
    await pumpPage(tester, [...products, _rated]);

    await tester.tap(find.text(ListingStrings.filter));
    await tester.pumpAndSettle();
    await tester.tap(find.text(ListingStrings.fourStarAndAbove));
    await tester.tap(find.text(ListingStrings.apply));
    await tester.pumpAndSettle();

    expect(find.text('Filter (1)'), findsOneWidget);
    expect(shown(tester), ['hazelnut-rocher']);
  });

  testWidgets('a filter that leaves nothing says so, and Clear filters brings all back', (
    tester,
  ) async {
    await pumpPage(tester, products);

    await tester.tap(find.text(ListingStrings.filter));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Above ₹2,000'));
    await tester.tap(find.text(ListingStrings.apply));
    await tester.pumpAndSettle();

    expect(find.byType(ProductCard), findsNothing);
    expect(find.text(ListingStrings.noMatchesTitle), findsOneWidget);
    // The bar stays, so the filter can be changed from here too.
    expect(find.text('Filter (1)'), findsOneWidget);

    await tester.tap(find.text(ListingStrings.clearFilters));
    await tester.pumpAndSettle();
    expect(find.text(ListingStrings.noMatchesTitle), findsNothing);
    expect(find.text(ListingStrings.filter), findsOneWidget);
    expect(shown(tester), popularity);
  });

  testWidgets('Clear in the sheet drops every filter at once', (tester) async {
    await pumpPage(tester, products);

    await tester.tap(find.text(ListingStrings.filter));
    await tester.pumpAndSettle();
    await tester.tap(find.text(ListingStrings.inStockOnly));
    await tester.tap(find.text(ListingStrings.apply));
    await tester.pumpAndSettle();
    expect(find.text('Filter (1)'), findsOneWidget);

    await tester.tap(find.text('Filter (1)'));
    await tester.pumpAndSettle();
    await tester.tap(find.text(ListingStrings.clear));
    await tester.pumpAndSettle();
    expect(find.text(ListingStrings.filter), findsOneWidget);
    expect(shown(tester), popularity);
  });

  testWidgets('an empty group: the empty state, and no bar to sort nothing with', (tester) async {
    await pumpPage(tester, const []);

    expect(find.text(CatalogStrings.emptyGroupTitle), findsOneWidget);
    expect(find.text(ListingStrings.filter), findsNothing);
  });

  group(
    'a module the shop switched off moves the card price, the sort and the filter together',
    () {
      Future<void> sortLowToHigh(WidgetTester tester) async {
        await tester.tap(find.text('Sort by · Popularity'));
        await tester.pumpAndSettle();
        await tester.tap(find.text(ListingStrings.sortPriceLowToHigh));
        await tester.pumpAndSettle();
      }

      Future<void> filterBand(WidgetTester tester, String band) async {
        await tester.tap(find.text(ListingStrings.filter));
        await tester.pumpAndSettle();
        await tester.tap(find.text(band));
        await tester.tap(find.text(ListingStrings.apply));
        await tester.pumpAndSettle();
      }

      testWidgets('every module on: ₹1,100 on the card, after ₹1,000, in ₹1,000 – ₹2,000', (
        tester,
      ) async {
        await pumpPage(tester, [_shaped, _flat]);
        expect(find.text('₹1,100'), findsOneWidget);
        await sortLowToHigh(tester);
        expect(shown(tester), ['plain-sponge', 'heart-truffle']);
        await filterBand(tester, '₹500 – ₹1,000');
        expect(find.text(ListingStrings.noMatchesTitle), findsOneWidget);
      });

      testWidgets('Shape off: ₹900 on the card, so it sorts first and is in ₹500 – ₹1,000', (
        tester,
      ) async {
        await pumpPage(tester, [_shaped, _flat], settings: _shapeOff());
        expect(find.text('₹900'), findsOneWidget);
        expect(find.text('₹1,100'), findsNothing);
        await sortLowToHigh(tester);
        expect(shown(tester), ['heart-truffle', 'plain-sponge']);
        await filterBand(tester, '₹500 – ₹1,000');
        expect(shown(tester), ['heart-truffle']);
      });
    },
  );
}
