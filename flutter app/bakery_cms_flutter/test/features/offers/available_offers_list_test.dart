import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/features/offers/domain/entities/coupon.dart';
import 'package:bakery_cms_flutter/features/offers/domain/usecases/get_live_coupons.dart';
import 'package:bakery_cms_flutter/features/offers/presentation/bloc/offers_cubit.dart';
import 'package:bakery_cms_flutter/features/offers/presentation/widgets/available_offers_list.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';

class _MockGetCoupons extends Mock implements GetLiveCoupons {}

/// The checkout drop-in: the website's coupon-panel offer cards.
void main() {
  const coupons = [
    Coupon(id: 'c1', code: 'BDAY20', label: '', percentOff: 20),
    Coupon(id: 'c2', code: 'SAVE500', label: '', flatOff: 500, minSubtotal: 2000),
  ];

  setUp(() async {
    await GetIt.I.reset();
    final get = _MockGetCoupons();
    when(() => get(const NoParams())).thenAnswer((_) async => const Right(coupons));
    GetIt.I.registerFactory(() => OffersCubit(get));
  });

  tearDown(() => GetIt.I.reset());

  Future<void> pump(WidgetTester tester, Widget list) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Scaffold(body: SingleChildScrollView(child: list)),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('what each code saves now, what the other still needs, and Apply', (tester) async {
    String? applied;
    await pump(
      tester,
      AvailableOffersList(subtotal: 1500, currency: 'INR', onApply: (code) => applied = code),
    );
    expect(find.text('Save ₹300'), findsOneWidget);
    expect(find.text('20% OFF'), findsOneWidget);
    expect(find.text('You will save ₹300 with this code'), findsOneWidget);
    expect(find.text('₹500 OFF'), findsOneWidget);
    expect(find.text('Add ₹500 more to use it'), findsOneWidget);
    // Only the one that applies can be applied.
    expect(find.text('Apply'), findsOneWidget);
    await tester.tap(find.text('Apply'));
    expect(applied, 'BDAY20');
  });

  testWidgets('the applied code is not offered again', (tester) async {
    await pump(
      tester,
      const AvailableOffersList(subtotal: 1500, currency: 'INR', appliedCode: 'BDAY20'),
    );
    expect(find.text('BDAY20'), findsNothing);
    expect(find.text('SAVE500'), findsOneWidget);
    expect(find.text('Apply'), findsNothing, reason: 'no onApply, no buttons');
  });

  testWidgets('no live coupons: nothing drawn at all', (tester) async {
    await GetIt.I.reset();
    final get = _MockGetCoupons();
    when(() => get(const NoParams())).thenAnswer((_) async => const Right([]));
    GetIt.I.registerFactory(() => OffersCubit(get));
    await pump(tester, const AvailableOffersList(subtotal: 1500, currency: 'INR'));
    expect(find.byType(Text), findsNothing);
  });
}
