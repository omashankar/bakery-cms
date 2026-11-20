import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/offers_strings.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_catalog.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_catalog_entry.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_state.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/widgets/extras_section.dart';
import 'package:bakery_cms_flutter/features/offers/domain/entities/coupon.dart';
import 'package:bakery_cms_flutter/features/offers/domain/usecases/get_live_coupons.dart';
import 'package:bakery_cms_flutter/features/offers/presentation/bloc/offers_cubit.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';

class _MockCheckoutBloc extends MockBloc<CheckoutEvent, CheckoutState> implements CheckoutBloc {}

class _MockGetCoupons extends Mock implements GetLiveCoupons {}

/// The offers under checkout's coupon box read the cart by line, with each
/// product's live categories, as the website's coupon panel reads
/// `couponLines`: a coupon kept to flowers is measured against the flowers.
void main() {
  // ₹1,000 of cake and ₹500 of roses: ₹1,500 in all.
  const cake = CartItem(
    id: 'cake',
    productSlug: 'truffle-cake',
    name: 'Truffle Cake',
    image: '',
    unitPrice: 1000,
    quantity: 1,
  );
  const roses = CartItem(
    id: 'roses',
    productSlug: 'red-roses',
    name: 'Red Roses',
    image: '',
    unitPrice: 250,
    quantity: 2,
  );
  const catalog = CheckoutCatalog({
    'truffle-cake': CheckoutCatalogEntry(slug: 'truffle-cake', categoryIds: ['cakes']),
    'red-roses': CheckoutCatalogEntry(slug: 'red-roses', categoryIds: ['flowers']),
  });
  const flowers20 = Coupon(
    id: 'c1',
    code: 'FLOWERS20',
    label: '',
    percentOff: 20,
    categoryIds: ['flowers'],
  );
  // Needs ₹600 of flowers: the basket's ₹1,500 is not ₹600 of flowers.
  const flowers100 = Coupon(
    id: 'c2',
    code: 'BLOOM100',
    label: '',
    flatOff: 100,
    minSubtotal: 600,
    categoryIds: ['flowers'],
  );

  late _MockCheckoutBloc bloc;

  setUp(() async {
    await GetIt.I.reset();
    final get = _MockGetCoupons();
    when(() => get(const NoParams())).thenAnswer((_) async => const Right([flowers20, flowers100]));
    GetIt.I.registerFactory(() => OffersCubit(get));
    bloc = _MockCheckoutBloc();
  });

  tearDown(() => GetIt.I.reset());

  Future<void> pump(WidgetTester tester, {required bool catalogueRead}) async {
    when(() => bloc.state).thenReturn(
      CheckoutState(
        setupStatus: ViewStatus.success,
        items: const [cake, roses],
        offerLines: catalogueRead ? catalog.offerLines(const [cake, roses]) : null,
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(
          body: BlocProvider<CheckoutBloc>.value(
            value: bloc,
            child: const SingleChildScrollView(child: ExtrasSection()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('a flowers coupon saves 20% of the ₹500 of roses, not of the ₹1,500 basket', (
    tester,
  ) async {
    await pump(tester, catalogueRead: true);

    expect(
      find.text('${OffersStrings.youWillSave} ₹100 ${OffersStrings.withThisCode}'),
      findsOneWidget,
    );
    expect(find.textContaining('₹300'), findsNothing, reason: '20% of the whole basket');
    // Its minimum is read against the flowers too: ₹100 more of them.
    expect(find.text('${OffersStrings.add} ₹100 ${OffersStrings.moreToUseIt}'), findsOneWidget);
    expect(find.text(OffersStrings.selectedItemsOnly), findsNothing);
  });

  testWidgets('before the catalogue answers, each scoped coupon says "selected items only"', (
    tester,
  ) async {
    await pump(tester, catalogueRead: false);

    expect(find.text(OffersStrings.selectedItemsOnly), findsNWidgets(2));
    expect(find.textContaining(OffersStrings.youWillSave), findsNothing);
  });
}
