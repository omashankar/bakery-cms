import 'package:bakery_cms_flutter/app/router/app_routes.dart';
import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/app_spacing.dart';
import 'package:bakery_cms_flutter/core/constants/strings/catalog_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/delivery_area_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/product_page_strings.dart';
import 'package:bakery_cms_flutter/core/utils/money_formatter.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_cubit.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_state.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/services/photo_print_renderer.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_weight.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_product_by_slug.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_related_products.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/upload_cake_photo.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/cake_photo/cake_photo_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_detail/product_detail_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/pages/product_detail_page.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/add_to_cart_bar.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/product_card.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/product_gallery.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/product_rating_row.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/wishlist_square_button.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_area.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_verdict.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_cubit.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_state.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_status.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_picker.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_cubit.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_state.dart';
import 'package:bakery_cms_flutter/features/wishlist/data/datasources/wishlist_local_data_source.dart';
import 'package:bakery_cms_flutter/features/wishlist/data/repositories/wishlist_repository_impl.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/remove_from_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/toggle_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/watch_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/widgets/wishlist_heart_button.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import '../catalog_fixtures.dart';
import '../product_page_harness.dart';

class _MockGetProduct extends Mock implements GetProductBySlug {}

class _MockGetRelated extends Mock implements GetRelatedProducts {}

class _MockPicker extends Mock implements PhotoPicker {}

class _MockUpload extends Mock implements UploadCakePhoto {}

class _MockRenderer extends Mock implements PhotoPrintRenderer {}

class _MockCart extends MockCubit<CartState> implements CartCubit {}

class _MockStore extends MockCubit<StoreConfigState> implements StoreConfigCubit {}

class _MockArea extends MockCubit<DeliveryAreaState> implements DeliveryAreaCubit {}

class _MemoryWishlist implements WishlistLocalDataSource {
  List<String> saved = const [];

  @override
  List<String> read() => saved;

  @override
  Future<void> write(List<String> slugs) async => saved = slugs;
}

/// The product page's layout: what it shows, what it never claims, and that
/// the bottom bar fits the narrowest phone at large text.
void main() {
  // No photos: a widget test has no network, and the page draws a placeholder.
  const reviewed = Product(
    id: 'p-reviewed',
    name: 'Red Velvet Cake',
    slug: 'red-velvet-cake',
    description: 'Soft red velvet with cream cheese',
    price: 650,
    compareAtPrice: 1000,
    images: [],
    categoryIds: [CatalogFixtures.chocolateId],
    occasionIds: [],
    weights: [
      ProductWeight(label: '0.5 Kg', price: 650),
      ProductWeight(label: '1 Kg', price: 1200),
    ],
    shapes: [],
    flavourOptions: [],
    variantGroups: [],
    descriptionBlocks: [],
    stockStatus: StockStatus.inStock,
    rating: 4.6,
    reviewCount: 14,
  );
  const unreviewed = Product(
    id: 'p-plain',
    name: 'Plain Sponge Cake With A Rather Long Name For A Narrow Phone',
    slug: 'plain-sponge',
    description: '',
    price: 400,
    images: [],
    categoryIds: [CatalogFixtures.chocolateId],
    occasionIds: [],
    weights: [ProductWeight(label: '1 Kg', price: 400)],
    shapes: [],
    flavourOptions: [],
    variantGroups: [],
    descriptionBlocks: [],
    stockStatus: StockStatus.inStock,
  );
  const sibling = Product(
    id: 'p-sibling',
    name: 'Choco Chip Cake',
    slug: 'choco-chip',
    description: '',
    price: 500,
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
  const kota = DeliveryArea(pincode: '324002', verdict: DeliveryVerdict.eligible, city: 'Kota');
  const mumbai = DeliveryArea(pincode: '400001', verdict: DeliveryVerdict.outside, city: 'Mumbai');

  late _MockCart cart;
  late _MockGetProduct getProduct;
  late _MockGetRelated getRelated;
  late _MemoryWishlist wishlist;

  setUpAll(() {
    registerFallbackValue(
      const CartItem(id: '', productSlug: '', name: '', image: '', unitPrice: 0, quantity: 1),
    );
    registerFallbackValue(reviewed);
  });

  setUp(() async {
    await GetIt.I.reset();
    getProduct = _MockGetProduct();
    getRelated = _MockGetRelated();
    for (final product in [reviewed, unreviewed]) {
      when(() => getProduct(product.slug)).thenAnswer((_) async => Right(product));
    }
    when(() => getRelated(any())).thenAnswer((_) async => const Right([]));
    GetIt.I
      ..registerFactory(() => ProductDetailCubit(getProduct, getRelatedProducts: getRelated))
      ..registerFactory(() => CakePhotoCubit(_MockPicker(), _MockUpload(), _MockRenderer()));
    registerProductPageBlocks();
    cart = _MockCart();
    when(() => cart.state).thenReturn(const CartState());
    when(() => cart.add(any(), announce: any(named: 'announce'))).thenAnswer((_) async {});
    wishlist = _MemoryWishlist();
  });

  tearDown(() => GetIt.I.reset());

  Future<void> open(
    WidgetTester tester,
    Product product, {
    DeliveryAreaState area = const DeliveryAreaState(),
    double textScale = 1,
  }) async {
    final store = _MockStore();
    when(() => store.state).thenReturn(const StoreConfigState());
    final areaCubit = _MockArea();
    when(() => areaCubit.state).thenReturn(area);
    final repository = WishlistRepositoryImpl(wishlist);
    final router = GoRouter(
      initialLocation: AppRoutes.product(product.slug),
      routes: [
        GoRoute(
          path: AppRoutes.productPattern,
          builder: (_, state) => ProductDetailPage(slug: state.pathParameters['slug']!),
        ),
        GoRoute(path: AppRoutes.cart, builder: (_, _) => const Text(_cartScreen)),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<CartCubit>.value(value: cart),
          BlocProvider<StoreConfigCubit>.value(value: store),
          BlocProvider<DeliveryAreaCubit>.value(value: areaCubit),
          // Made here, inside the test's zone: one made in setUp would listen
          // in the real zone and a pump would never deliver its changes.
          BlocProvider(
            create: (_) => WishlistCubit(
              watchWishlist: WatchWishlist(repository),
              toggleWishlist: ToggleWishlist(repository),
              removeFromWishlist: RemoveFromWishlist(repository),
            )..start(),
          ),
        ],
        child: MaterialApp.router(
          theme: AppTheme.light,
          routerConfig: router,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  void useScreen(WidgetTester tester, double width) {
    tester.view
      ..devicePixelRatio = 1
      ..physicalSize = Size(width, 700);
    addTearDown(tester.view.reset);
  }

  /// Every string on screen, as a reader sees it.
  String everything(WidgetTester tester) => tester
      .widgetList<RichText>(find.byType(RichText))
      .map((text) => text.text.toPlainText())
      .join('\n');

  Finder barButton(String label) => find.ancestor(
    of: find.text(label),
    matching: find.byWidgetPredicate((widget) => widget is ButtonStyleButton),
  );

  group('rating', () {
    testWidgets('no reviews: no badge, no count, nothing about ratings', (tester) async {
      await open(tester, unreviewed);

      expect(find.byType(ProductRatingRow), findsNothing);
      expect(everything(tester), isNot(contains(ProductPageStrings.ratingAnd)));
      expect(everything(tester), isNot(contains(ProductPageStrings.reviews)));
    });

    testWidgets('with reviews: "4.6" in the badge and "Rating & 14 Reviews"', (tester) async {
      await open(tester, reviewed);

      expect(find.byType(ProductRatingRow), findsOneWidget);
      expect(find.text('4.6'), findsOneWidget);
      expect(find.text('Rating & 14 Reviews'), findsOneWidget);
    });

    test('one review is a "Review", not "Reviews"', () {
      expect(ProductRatingRow.countLabel(1), 'Rating & 1 Review');
      expect(ProductRatingRow.countLabel(14), 'Rating & 14 Reviews');
    });
  });

  group('price', () {
    testWidgets('the chosen price, the struck "was" price and the percent off', (tester) async {
      await open(tester, reviewed);

      expect(find.text(MoneyFormatter.format(650)), findsOneWidget);
      final was = tester.widget<Text>(find.text(MoneyFormatter.format(1000)));
      expect(was.style?.decoration, TextDecoration.lineThrough);
      expect(find.text('35${ProductPageStrings.percentOffSuffix}'), findsOneWidget);
    });

    testWidgets('a bigger size moves the struck price by what it adds, as the website', (
      tester,
    ) async {
      await open(tester, reviewed);

      await tester.ensureVisible(find.text('1 Kg'));
      await tester.tap(find.text('1 Kg'));
      await tester.pumpAndSettle();

      // 1 Kg is ₹550 over the base, so the ₹1,000 "was" becomes ₹1,550
      // (`displayCompareAtPrice`): the shop's ₹350 saving is kept.
      expect(find.text(MoneyFormatter.format(1200)), findsOneWidget);
      expect(find.text(MoneyFormatter.format(650)), findsNothing);
      final was = tester.widget<Text>(find.text(MoneyFormatter.format(1550)));
      expect(was.style?.decoration, TextDecoration.lineThrough);
      expect(find.text('23${ProductPageStrings.percentOffSuffix}'), findsOneWidget);
    });

    testWidgets('the tax line says GST is added, and never "inclusive"', (tester) async {
      await open(tester, reviewed);

      expect(find.text(ProductPageStrings.taxNote), findsOneWidget);
      final shown = everything(tester).toLowerCase();
      for (final claim in ['inclusive', 'incl.', 'incl ', 'including', 'all taxes', 'tax incl']) {
        expect(shown, isNot(contains(claim)), reason: 'the shop adds GST at checkout');
      }
      expect(ProductPageStrings.taxNote.toLowerCase(), contains('gst'));
    });
  });

  group('wishlist heart', () {
    testWidgets('on the photo and in the bar, and the two agree', (tester) async {
      await open(tester, reviewed);

      final onPhoto = find.descendant(
        of: find.byType(ProductGallery),
        matching: find.byType(WishlistHeartButton),
      );
      final inBar = find.descendant(
        of: find.byType(AddToCartBar),
        matching: find.byType(WishlistSquareButton),
      );
      expect(onPhoto, findsOneWidget);
      expect(inBar, findsOneWidget);

      await tester.tap(inBar);
      await tester.pumpAndSettle();

      expect(wishlist.saved, [reviewed.slug]);
      expect(
        find.descendant(of: onPhoto, matching: find.byIcon(Icons.favorite)),
        findsOneWidget,
        reason: 'the heart on the photo reads the same wishlist',
      );
    });
  });

  group('bottom bar', () {
    // The test font draws every letter a full em wide, about twice a real
    // font's width, so a page that fits here fits a real phone with room.
    // (At 320dp and 1.3x that font also overflows the delivery_area
    // feature's own "Not delivered here" tag; a real font fits it.)
    for (final (width, scale) in [(320.0, 1.0), (320.0, 1.3), (360.0, 1.3)]) {
      for (final product in [reviewed, unreviewed]) {
        testWidgets(
          '${product.slug} fits ${width.toInt()}dp at text ${scale}x, every control on screen',
          (tester) async {
            useScreen(tester, width);
            await open(
              tester,
              product,
              textScale: scale,
              area: const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota),
            );

            // A RenderFlex overflow is reported as an exception.
            expect(tester.takeException(), isNull);
            final bar = tester.getRect(find.byType(AddToCartBar));
            for (final control in [
              find.byType(WishlistSquareButton),
              barButton(CatalogStrings.addToCart),
              barButton(CatalogStrings.buyNow),
            ]) {
              final box = tester.getRect(control);
              expect(box.left, greaterThanOrEqualTo(bar.left));
              expect(box.right, lessThanOrEqualTo(bar.right));
              expect(box.width, greaterThan(0));
            }
            // Each label is one line, inside its own button.
            for (final label in [CatalogStrings.addToCart, CatalogStrings.buyNow]) {
              final text = tester.getRect(find.text(label));
              final button = tester.getRect(barButton(label));
              expect(
                button.contains(text.topLeft) &&
                    button.contains(text.bottomRight - const Offset(1, 1)),
                isTrue,
              );
            }
            // One row of controls: a wrapped label would make the bar grow.
            expect(bar.height, lessThanOrEqualTo(AppSpacing.buttonHeight + 2 * AppSpacing.md + 1));
          },
        );
      }
    }

    testWidgets('Add to cart announces; Buy now goes to the cart quietly', (tester) async {
      await open(tester, reviewed);

      await tester.tap(barButton(CatalogStrings.addToCart));
      await tester.pump();
      verify(() => cart.add(any(), announce: true)).called(1);

      await tester.tap(barButton(CatalogStrings.buyNow));
      await tester.pumpAndSettle();
      verify(() => cart.add(any(), announce: false)).called(1);
      expect(find.text(_cartScreen), findsOneWidget);
    });

    testWidgets('the quantity is chosen on the page and reaches the cart line', (tester) async {
      await open(tester, reviewed);
      expect(
        find.descendant(of: find.byType(AddToCartBar), matching: find.byIcon(Icons.add)),
        findsNothing,
        reason: 'the stepper moved out of the bar',
      );

      await tester.ensureVisible(find.byIcon(Icons.add));
      await tester.tap(find.byIcon(Icons.add));
      await tester.pump();
      await tester.tap(barButton(CatalogStrings.addToCart));

      final added =
          verify(() => cart.add(captureAny(), announce: any(named: 'announce'))).captured.single
              as CartItem;
      expect(added.quantity, 2);
    });
  });

  group('delivery', () {
    testWidgets('the chosen PIN code and its earliest day show on the page', (tester) async {
      await open(
        tester,
        reviewed,
        area: const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota),
      );

      expect(find.textContaining(kota.pincode, findRichText: true), findsOneWidget);
      expect(find.text(DeliveryAreaStrings.delivers), findsOneWidget);
      expect(find.text(ProductPageStrings.notDeliveredHint), findsNothing);
    });

    testWidgets('not delivered: it says so, and Add to cart still works', (tester) async {
      await open(
        tester,
        reviewed,
        area: const DeliveryAreaState(status: DeliveryAreaStatus.notDelivered, area: mumbai),
      );

      expect(find.text(DeliveryAreaStrings.notDelivered), findsOneWidget);
      expect(find.text(ProductPageStrings.notDeliveredHint), findsOneWidget);
      final add = tester.widget<ButtonStyleButton>(barButton(CatalogStrings.addToCart));
      expect(add.onPressed, isNotNull, reason: 'checkout decides against the real address');
    });
  });

  group('you may also like', () {
    testWidgets('others from the same category, as the shop\'s own cards', (tester) async {
      when(() => getRelated(any())).thenAnswer((_) async => const Right([sibling]));
      await open(tester, reviewed);

      expect(find.text(ProductPageStrings.youMayAlsoLike), findsOneWidget);
      expect(
        find.descendant(of: find.byType(ProductCard), matching: find.text(sibling.name)),
        findsOneWidget,
      );
    });

    testWidgets('none: no heading', (tester) async {
      await open(tester, reviewed);

      expect(find.text(ProductPageStrings.youMayAlsoLike), findsNothing);
    });
  });
}

const String _cartScreen = 'the cart screen';
