import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/offers_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/questions_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/reviews_strings.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/money_formatter.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_cubit.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_state.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_weight.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_group.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_option.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/services/photo_print_renderer.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_product_by_slug.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/upload_cake_photo.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/cake_photo/cake_photo_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_detail/product_detail_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/pages/product_detail_page.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_cubit.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_state.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_picker.dart';
import 'package:bakery_cms_flutter/features/offers/domain/entities/coupon.dart';
import 'package:bakery_cms_flutter/features/product_questions/domain/entities/product_question.dart';
import 'package:bakery_cms_flutter/features/reviews/domain/entities/product_review.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/payment_methods.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_cubit.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_state.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';

import '../catalog_fixtures.dart';
import '../product_page_harness.dart';

class _MockGetProduct extends Mock implements GetProductBySlug {}

class _MockCart extends MockCubit<CartState> implements CartCubit {}

class _MockStore extends MockCubit<StoreConfigState> implements StoreConfigCubit {}

class _MockWishlist extends MockCubit<WishlistState> implements WishlistCubit {}

class _MockArea extends MockCubit<DeliveryAreaState> implements DeliveryAreaCubit {}

/// The product page's blocks below the buy box — offers, reviews, questions
/// — and the shop's modules, on the real page.
void main() {
  const cake = Product(
    id: 'p-shaped',
    name: 'Shaped Cake',
    slug: 'shaped-cake',
    description: 'A cake that comes in shapes',
    price: 800,
    compareAtPrice: 1000,
    images: [],
    categoryIds: [CatalogFixtures.chocolateId],
    occasionIds: [],
    weights: [ProductWeight(label: '0.5 kg', price: 800)],
    shapes: [],
    flavourOptions: ['Vanilla', 'Chocolate'],
    variantGroups: [
      VariantGroup(
        id: 'g-shape',
        name: 'Cake shape',
        required: true,
        type: VariantGroup.shape,
        options: [
          VariantOption(id: 'heart', label: 'Heart', priceAdjustment: 150, isDefault: true),
          VariantOption(id: 'round', label: 'Round', priceAdjustment: 0),
        ],
      ),
    ],
    descriptionBlocks: [],
    stockStatus: StockStatus.inStock,
    allowsMessage: true,
    rating: 4.5,
    reviewCount: 2,
  );
  const reviews = [
    ProductReview(id: 'r1', author: 'Asha', rating: 5, body: 'Lovely and fresh', title: 'Superb'),
    ProductReview(id: 'r2', author: 'Ravi', rating: 4, body: 'Good cake'),
  ];
  const questions = [
    ProductQuestion(id: 'q1', name: 'Neha', question: 'Is it eggless?', answer: 'On request.'),
  ];
  const coupons = [Coupon(id: 'c1', code: 'BDAY20', label: '', percentOff: 20)];

  StoreConfig shop({Map<String, bool> modules = const {}}) => StoreConfig(
    siteName: 'Sweet Crumbs',
    tagline: '',
    logoUrl: '',
    currency: 'INR',
    deliveryFee: 99,
    freeDeliveryThreshold: 999,
    minOrderValue: 0,
    useZoneBasedDelivery: false,
    deliveryLeadDays: 0,
    sameDayCutoff: '',
    deliveryTimeSlots: const [],
    deliveryTiers: const [],
    giftWrapEnabled: false,
    giftWrapFee: 0,
    giftWrapLabel: '',
    checkoutTerms: '',
    paymentMethods: const PaymentMethods(cod: true, upi: true, card: true, razorpay: true),
    maintenanceEnabled: false,
    maintenanceMessage: '',
    modules: modules,
  );

  late _MockCart cart;
  late ({
    MockGetProductReviews reviews,
    MockGetProductQuestions questions,
    MockGetLiveCoupons coupons,
  })
  reads;

  setUpAll(() {
    registerFallbackValue(
      const CartItem(id: '', productSlug: '', name: '', image: '', unitPrice: 0, quantity: 1),
    );
  });

  setUp(() async {
    await GetIt.I.reset();
    final getProduct = _MockGetProduct();
    when(() => getProduct(cake.slug)).thenAnswer((_) async => const Right(cake));
    GetIt.I
      ..registerFactory(() => ProductDetailCubit(getProduct))
      ..registerFactory(() => CakePhotoCubit(_FakePicker(), _FakeUpload(), _FakeRenderer()));
    reads = registerProductPageBlocks(reviews: reviews, questions: questions, coupons: coupons);
    cart = _MockCart();
    when(() => cart.state).thenReturn(const CartState());
    when(() => cart.add(any(), announce: any(named: 'announce'))).thenAnswer((_) async {});
  });

  tearDown(() => GetIt.I.reset());

  Future<void> open(WidgetTester tester, {StoreConfig? config}) async {
    final store = _MockStore();
    when(
      () => store.state,
    ).thenReturn(StoreConfigState(status: ViewStatus.success, config: config ?? shop()));
    final wishlist = _MockWishlist();
    when(() => wishlist.state).thenReturn(const WishlistState());
    final area = _MockArea();
    when(() => area.state).thenReturn(const DeliveryAreaState());
    await tester.pumpWidget(
      MultiBlocProvider(
        providers: [
          BlocProvider<CartCubit>.value(value: cart),
          BlocProvider<StoreConfigCubit>.value(value: store),
          BlocProvider<WishlistCubit>.value(value: wishlist),
          BlocProvider<DeliveryAreaCubit>.value(value: area),
        ],
        child: MaterialApp(
          theme: AppTheme.light,
          home: ProductDetailPage(slug: cake.slug),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> scrollTo(WidgetTester tester, Finder target) async {
    await tester.scrollUntilVisible(target, 300, scrollable: find.byType(Scrollable).first);
    await tester.pumpAndSettle();
  }

  testWidgets('reviews and questions are not asked for until they near the screen', (tester) async {
    tester.view.physicalSize = const Size(400, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await open(tester);
    verifyNever(() => reads.reviews(any()));
    verifyNever(() => reads.questions(any()));

    await scrollTo(tester, find.text(QuestionsStrings.askAQuestion));
    verify(() => reads.reviews(cake.slug)).called(1);
    verify(() => reads.questions(cake.slug)).called(1);
  });

  testWidgets('the reviews block: summary, cards, and "Rate Product" opens the form', (
    tester,
  ) async {
    await open(tester);
    await scrollTo(tester, find.text(ReviewsStrings.rateProduct));

    expect(find.text('4.5 ★'), findsOneWidget);
    expect(find.text('based on 2 ratings'), findsOneWidget);
    expect(find.text('Superb'), findsOneWidget);
    // No title: the word for the score, as the website does.
    expect(find.text('Very Good'), findsWidgets);
    expect(find.text('Lovely and fresh'), findsOneWidget);

    await tester.ensureVisible(find.text(ReviewsStrings.rateProduct));
    await tester.pumpAndSettle();
    await tester.tap(find.text(ReviewsStrings.rateProduct));
    await tester.pumpAndSettle();
    expect(find.text('${ReviewsStrings.formTitlePrefix} ${cake.name}'), findsOneWidget);
  });

  testWidgets('the questions block: answered ones, and the ask form behind its button', (
    tester,
  ) async {
    await open(tester);
    await scrollTo(tester, find.text(QuestionsStrings.askAQuestion));
    expect(find.text('1 answered question'), findsOneWidget);
    expect(find.text('Q: Is it eggless?'), findsOneWidget);
    expect(find.text('A: On request.'), findsOneWidget);

    await tester.ensureVisible(find.text(QuestionsStrings.askAQuestion));
    await tester.pumpAndSettle();
    await tester.tap(find.text(QuestionsStrings.askAQuestion));
    await tester.pumpAndSettle();
    expect(find.text(QuestionsStrings.formTitle), findsOneWidget);
  });

  testWidgets('available offers: free delivery and the live code, once the product is in', (
    tester,
  ) async {
    await open(tester);
    verify(() => reads.coupons(const NoParams())).called(1);
    await scrollTo(tester, find.text(OffersStrings.availableOffers));
    expect(find.text('Free delivery on orders over ₹999'), findsOneWidget);
    expect(find.text('Use code BDAY20 — 20% OFF'), findsOneWidget);
  });

  testWidgets('Shape on: the shape group is offered and its default priced', (tester) async {
    await open(tester);
    expect(find.text('Cake shape'), findsOneWidget);
    expect(find.text(MoneyFormatter.format(950)), findsWidgets);
    // The legacy flavour list is never offered, as on the website.
    expect(find.text('Vanilla'), findsNothing);
    // Weight on: even one size is shown, as the website's picker shows it.
    expect(find.text('0.5 kg'), findsOneWidget);
  });

  testWidgets('Shape off: no shape group, and its surcharge is not in the price', (tester) async {
    await open(tester, config: shop(modules: {'shape': false}));
    expect(find.text('Cake shape'), findsNothing);
    expect(find.text(MoneyFormatter.format(800)), findsWidgets);
    expect(find.text(MoneyFormatter.format(950)), findsNothing);
  });

  testWidgets('Weight off: no size picker', (tester) async {
    await open(tester, config: shop(modules: {'weight': false}));
    expect(find.text('0.5 kg'), findsNothing);
  });
}

class _FakePicker extends Mock implements PhotoPicker {}

class _FakeUpload extends Mock implements UploadCakePhoto {}

class _FakeRenderer extends Mock implements PhotoPrintRenderer {}
