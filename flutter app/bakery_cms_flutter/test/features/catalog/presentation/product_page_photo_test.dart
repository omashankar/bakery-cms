import 'dart:async';
import 'dart:ui' as ui;

import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/catalog_strings.dart';
import 'package:bakery_cms_flutter/core/error/failure.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_cubit.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_state.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/photo_frame_shape.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/photo_print_draft.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_weight.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/services/photo_print_renderer.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_product_by_slug.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/upload_cake_photo.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/cake_photo/cake_photo_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_detail/product_detail_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/pages/product_detail_page.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/painting/photo_image_decoder.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/widgets/photo_print_editor.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_cubit.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_state.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_picker.dart';
import 'package:bakery_cms_flutter/features/media/domain/photo_source.dart';
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

class _MockPicker extends Mock implements PhotoPicker {}

class _MockUpload extends Mock implements UploadCakePhoto {}

class _MockRenderer extends Mock implements PhotoPrintRenderer {}

class _MockDecoder extends Mock implements PhotoImageDecoder {}

class _MockCart extends MockCubit<CartState> implements CartCubit {}

class _MockStore extends MockCubit<StoreConfigState> implements StoreConfigCubit {}

class _MockWishlist extends MockCubit<WishlistState> implements WishlistCubit {}

class _MockArea extends MockCubit<DeliveryAreaState> implements DeliveryAreaCubit {}

/// The real product page: the photo the customer picks is fitted in the
/// editor, the PRINT (not the original) is uploaded and reaches the cart
/// line, and Add to cart waits while it uploads (the website's flow).
void main() {
  // A heart-shaped photo cake, as the live shop's red-rose cake is.
  const cake = Product(
    id: 'p-photo',
    name: 'Photo Cake',
    slug: 'photo-cake',
    description: 'Your picture, printed on the cake',
    price: 899,
    images: [],
    categoryIds: [CatalogFixtures.chocolateId],
    occasionIds: [],
    weights: [ProductWeight(label: '1 Kg', price: 899)],
    shapes: [],
    flavourOptions: [],
    variantGroups: [],
    descriptionBlocks: [],
    stockStatus: StockStatus.inStock,
    allowsPhotoUpload: true,
    photoFrameShape: 'heart',
  );
  const url = CatalogFixtures.photoUrl;
  const path = '/cache/does-not-exist.jpg'; // the customer's own photo
  const printed = '/cache/photo-print-1.jpg'; // what the editor painted
  late _MockCart cart;
  late _MockRenderer renderer;
  late _MockUpload upload;
  late Completer<Either<Failure, String>> answer;
  ui.Image? photo;

  setUpAll(() {
    registerFallbackValue(
      const CartItem(id: '', productSlug: '', name: '', image: '', unitPrice: 0, quantity: 1),
    );
    registerFallbackValue(PhotoSource.gallery);
    registerFallbackValue(PhotoFrameShape.circle);
    registerFallbackValue(PhotoPrintDraft.empty);
  });

  setUp(() async {
    await GetIt.I.reset();
    final getProduct = _MockGetProduct();
    final picker = _MockPicker();
    upload = _MockUpload();
    renderer = _MockRenderer();
    final decoder = _MockDecoder();
    when(() => getProduct(cake.slug)).thenAnswer((_) async => const Right(cake));
    when(() => picker.pick(any())).thenAnswer((_) async => path);
    when(() => upload(printed)).thenAnswer((_) => answer.future);
    when(
      () => renderer.render(
        sourcePath: any(named: 'sourcePath'),
        shape: any(named: 'shape'),
        draft: any(named: 'draft'),
      ),
    ).thenAnswer((_) async => printed);
    when(() => decoder.sizeOf(path)).thenAnswer((_) async => 1024);
    when(() => decoder.decode(path)).thenAnswer((_) async => photo!.clone());
    GetIt.I
      ..registerFactory(() => ProductDetailCubit(getProduct))
      ..registerFactory(() => CakePhotoCubit(picker, upload, renderer))
      ..registerSingleton<PhotoImageDecoder>(decoder);
    registerProductPageBlocks();
    cart = _MockCart();
    when(() => cart.state).thenReturn(const CartState());
    when(() => cart.add(any(), announce: any(named: 'announce'))).thenAnswer((_) async {});
  });

  tearDown(() => GetIt.I.reset());

  Future<void> open(WidgetTester tester) async {
    final store = _MockStore();
    when(() => store.state).thenReturn(const StoreConfigState());
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

  VoidCallback? addToCart(WidgetTester tester) => tester
      .widget<ButtonStyleButton>(
        find.ancestor(
          of: find.text(CatalogStrings.addToCart),
          matching: find.byWidgetPredicate((widget) => widget is ButtonStyleButton),
        ),
      )
      .onPressed;

  testWidgets('the picked photo is fitted, the PRINT uploads, and the line carries it', (
    tester,
  ) async {
    // Made inside the test: a Completer from setUp completes on the real
    // microtask queue, which a widget test's pump never runs.
    answer = Completer();
    photo ??= await tester.runAsync(() => createTestImage(width: 40, height: 30));
    await open(tester);
    expect(find.textContaining(CatalogStrings.photoTitle, findRichText: true), findsOneWidget);
    expect(addToCart(tester), isNotNull, reason: 'the photo is optional');

    await tester.ensureVisible(find.text(CatalogStrings.photoGallery));
    await tester.tap(find.text(CatalogStrings.photoGallery));
    await tester.pumpAndSettle();

    // The editor, on the photo, before anything is sent.
    expect(find.byType(PhotoPrintEditor), findsOneWidget);
    expect(find.text(CatalogStrings.printEditorTitle), findsOneWidget);
    verifyNever(() => upload(any()));

    await tester.ensureVisible(find.text(CatalogStrings.printTabName));
    await tester.pumpAndSettle();
    await tester.tap(find.text(CatalogStrings.printTabName));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), 'Riya');
    await tester.pump();
    await tester.ensureVisible(find.text(CatalogStrings.printUse));
    await tester.tap(find.text(CatalogStrings.printUse));
    await tester.pump();
    // The editor route closing (the upload spinner never settles).
    await tester.pump(const Duration(seconds: 1));

    expect(find.byType(PhotoPrintEditor), findsNothing);
    final draft =
        verify(
              () => renderer.render(
                sourcePath: path,
                shape: PhotoFrameShape.heart,
                draft: captureAny(named: 'draft'),
              ),
            ).captured.single
            as PhotoPrintDraft;
    expect(draft.name, 'Riya');
    verify(() => upload(printed)).called(1);
    verifyNever(() => upload(path));
    expect(find.text(CatalogStrings.photoUploading), findsOneWidget);
    expect(addToCart(tester), isNull, reason: 'the cake would go without its photo');

    answer.complete(const Right(url));
    await tester.pumpAndSettle();
    expect(find.text(CatalogStrings.photoUploaded), findsOneWidget);

    await tester.tap(find.text(CatalogStrings.addToCart));
    final added =
        verify(() => cart.add(captureAny(), announce: any(named: 'announce'))).captured.single
            as CartItem;
    expect(added.photoUrl, url);
  });

  testWidgets('cancelling the editor sends nothing and leaves no photo', (tester) async {
    photo ??= await tester.runAsync(() => createTestImage(width: 40, height: 30));
    await open(tester);
    await tester.ensureVisible(find.text(CatalogStrings.photoGallery));
    await tester.tap(find.text(CatalogStrings.photoGallery));
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text(CatalogStrings.printCancel));
    await tester.tap(find.text(CatalogStrings.printCancel));
    await tester.pumpAndSettle();

    expect(find.byType(PhotoPrintEditor), findsNothing);
    verifyNever(() => upload(any()));
    expect(find.text(CatalogStrings.photoHint), findsOneWidget);
    expect(addToCart(tester), isNotNull);
  });

  testWidgets('without a photo the cake still goes in, with none', (tester) async {
    await open(tester);

    await tester.tap(find.text(CatalogStrings.addToCart));
    final added =
        verify(() => cart.add(captureAny(), announce: any(named: 'announce'))).captured.single
            as CartItem;
    expect(added.photoUrl, isNull);
  });
}
