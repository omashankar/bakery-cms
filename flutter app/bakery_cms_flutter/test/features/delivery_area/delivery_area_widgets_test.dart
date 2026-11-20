import 'package:bakery_cms_flutter/core/constants/strings/delivery_area_strings.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/date_formatter.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/services/shop_clock.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_area.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_verdict.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/usecases/check_delivery_area.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_cubit.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_state.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/delivery_area_status.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/bloc/pincode_check_cubit.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/widgets/delivery_area_bar.dart';
import 'package:bakery_cms_flutter/features/delivery_area/presentation/widgets/earliest_delivery_text.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_cubit.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:get_it/get_it.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout/checkout_fixtures.dart';

class _MockDeliveryAreaCubit extends MockCubit<DeliveryAreaState> implements DeliveryAreaCubit {}

class _MockStoreConfigCubit extends MockCubit<StoreConfigState> implements StoreConfigCubit {}

class _MockCheck extends Mock implements CheckDeliveryArea {}

void main() {
  late _MockDeliveryAreaCubit area;
  late _MockStoreConfigCubit store;
  late _MockCheck check;

  const kota = DeliveryArea(
    pincode: '324002',
    verdict: DeliveryVerdict.eligible,
    city: 'Kota',
    charge: 99,
    freeDeliveryThreshold: 999,
  );
  const mumbai = DeliveryArea(pincode: '400001', verdict: DeliveryVerdict.outside, city: 'Mumbai');

  setUpAll(() => registerFallbackValue(kota));

  setUp(() {
    area = _MockDeliveryAreaCubit();
    store = _MockStoreConfigCubit();
    check = _MockCheck();
    when(
      () => store.state,
    ).thenReturn(const StoreConfigState(status: ViewStatus.success, config: config));
    when(() => area.save(any())).thenAnswer((_) async {});
    when(() => area.retry()).thenAnswer((_) async {});
    GetIt.I.registerFactory(() => PincodeCheckCubit(check));
  });

  tearDown(GetIt.I.reset);

  void given(DeliveryAreaState state) => when(() => area.state).thenReturn(state);

  FilledButton saveButton(WidgetTester tester) =>
      tester.widget<FilledButton>(find.widgetWithText(FilledButton, DeliveryAreaStrings.save));

  Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
    MultiBlocProvider(
      providers: [
        BlocProvider<DeliveryAreaCubit>.value(value: area),
        BlocProvider<StoreConfigCubit>.value(value: store),
      ],
      child: MaterialApp(home: Scaffold(body: child)),
    ),
  );

  group('DeliveryAreaBar', () {
    testWidgets('none chosen: asks for a pincode, and says nothing about delivery', (tester) async {
      given(const DeliveryAreaState());
      await pump(tester, const DeliveryAreaBar());
      expect(find.text(DeliveryAreaStrings.addPincode), findsOneWidget);
      expect(find.text(DeliveryAreaStrings.delivers), findsNothing);
      expect(find.text(DeliveryAreaStrings.notDelivered), findsNothing);
    });

    testWidgets('delivers: the PIN code, its place, and "Delivers here"', (tester) async {
      given(const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota));
      await pump(tester, const DeliveryAreaBar());
      expect(find.text('Deliver to 324002 · Kota', findRichText: true), findsOneWidget);
      expect(find.text(DeliveryAreaStrings.delivers), findsOneWidget);
      expect(find.text(DeliveryAreaStrings.addPincode), findsNothing);
    });

    testWidgets('a PIN with no known place shows the PIN code alone', (tester) async {
      given(
        const DeliveryAreaState(
          status: DeliveryAreaStatus.delivers,
          area: DeliveryArea(pincode: '324002', verdict: DeliveryVerdict.eligible),
        ),
      );
      await pump(tester, const DeliveryAreaBar());
      expect(find.text('Deliver to 324002', findRichText: true), findsOneWidget);
    });

    testWidgets('not delivered: says so', (tester) async {
      given(const DeliveryAreaState(status: DeliveryAreaStatus.notDelivered, area: mumbai));
      await pump(tester, const DeliveryAreaBar());
      expect(find.text(DeliveryAreaStrings.notDelivered), findsOneWidget);
      expect(find.text(DeliveryAreaStrings.delivers), findsNothing);
    });

    testWidgets('not delivered fits a narrow phone at a large text size', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      given(const DeliveryAreaState(status: DeliveryAreaStatus.notDelivered, area: mumbai));
      await tester.pumpWidget(
        MultiBlocProvider(
          providers: [
            BlocProvider<DeliveryAreaCubit>.value(value: area),
            BlocProvider<StoreConfigCubit>.value(value: store),
          ],
          child: const MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(size: Size(320, 640), textScaler: TextScaler.linear(1.3)),
              child: Scaffold(body: DeliveryAreaBar()),
            ),
          ),
        ),
      );
      expect(tester.takeException(), isNull);
      expect(find.text(DeliveryAreaStrings.notDelivered), findsOneWidget);
    });

    testWidgets('on a phone the place keeps most of the row; the tag never takes half', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      given(const DeliveryAreaState(status: DeliveryAreaStatus.delivers, area: kota));
      await pump(tester, const DeliveryAreaBar());

      // The bar's own side padding (16 each side) is not the row.
      final row = tester.getSize(find.byType(DeliveryAreaBar)).width - 32;
      final tag = tester.getSize(
        find.ancestor(
          of: find.text(DeliveryAreaStrings.delivers),
          matching: find.byType(FittedBox),
        ),
      );
      final place = tester.getSize(
        find.ancestor(of: find.byIcon(Icons.location_on_outlined), matching: find.byType(Expanded)),
      );
      expect(tag.width, lessThanOrEqualTo(row * 0.4));
      expect(place.width, greaterThanOrEqualTo(row * 0.55));
    });

    testWidgets('parts of a PIN: says so', (tester) async {
      given(
        const DeliveryAreaState(
          status: DeliveryAreaStatus.partly,
          area: DeliveryArea(pincode: '324001', verdict: DeliveryVerdict.partly),
        ),
      );
      await pump(tester, const DeliveryAreaBar());
      expect(find.text(DeliveryAreaStrings.deliversToParts), findsOneWidget);
    });

    testWidgets('checking: a spinner, the chosen PIN still shown', (tester) async {
      given(const DeliveryAreaState(status: DeliveryAreaStatus.checking, area: kota));
      await pump(tester, const DeliveryAreaBar());
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Deliver to 324002 · Kota', findRichText: true), findsOneWidget);
    });

    testWidgets('a failed check offers a retry that asks again', (tester) async {
      given(
        const DeliveryAreaState(
          status: DeliveryAreaStatus.failure,
          area: kota,
          errorMessage: 'offline',
        ),
      );
      await pump(tester, const DeliveryAreaBar());
      await tester.tap(find.text(DeliveryAreaStrings.couldNotCheck));
      verify(() => area.retry()).called(1);
    });

    testWidgets('a tap opens the sheet; Check then Save makes the answer the chosen area', (
      tester,
    ) async {
      given(const DeliveryAreaState());
      when(() => check('324002')).thenAnswer((_) async => const Right(kota));
      await pump(tester, const DeliveryAreaBar());

      await tester.tap(find.text(DeliveryAreaStrings.addPincode));
      await tester.pumpAndSettle();
      expect(find.text(DeliveryAreaStrings.sheetTitle), findsOneWidget);
      // Nothing to save until the shop has answered.
      expect(saveButton(tester).onPressed, isNull);

      await tester.enterText(find.byType(TextFormField), '324002');
      await tester.tap(find.text(DeliveryAreaStrings.check));
      await tester.pumpAndSettle();
      expect(find.text(DeliveryAreaStrings.eligibleHeadline), findsOneWidget);
      expect(find.textContaining('99'), findsOneWidget);
      verifyNever(() => area.save(any()));

      await tester.tap(find.text(DeliveryAreaStrings.save));
      await tester.pumpAndSettle();
      verify(() => area.save(kota)).called(1);
      expect(find.text(DeliveryAreaStrings.sheetTitle), findsNothing);
    });

    testWidgets('the sheet refuses a PIN code that is not six digits, without asking', (
      tester,
    ) async {
      given(const DeliveryAreaState());
      await pump(tester, const DeliveryAreaBar());
      await tester.tap(find.text(DeliveryAreaStrings.addPincode));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField), '02400');
      await tester.tap(find.text(DeliveryAreaStrings.check));
      await tester.pumpAndSettle();
      expect(find.text('Enter a 6-digit PIN code'), findsOneWidget);
      verifyNever(() => check(any()));
    });

    testWidgets('the sheet shows a failed check with a retry, and Save stays off', (tester) async {
      given(const DeliveryAreaState());
      when(() => check('324002')).thenAnswer((_) async => const Left(NetworkFailure()));
      await pump(tester, const DeliveryAreaBar());
      await tester.tap(find.text(DeliveryAreaStrings.addPincode));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextFormField), '324002');
      await tester.tap(find.text(DeliveryAreaStrings.check));
      await tester.pumpAndSettle();
      expect(find.text(const NetworkFailure().message), findsOneWidget);
      expect(saveButton(tester).onPressed, isNull);
      await tester.tap(find.text(DeliveryAreaStrings.save));
      await tester.pumpAndSettle();
      verifyNever(() => area.save(any()));

      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      verify(() => check('324002')).called(2);
    });
  });

  group('EarliestDeliveryText', () {
    StoreConfig shop({int leadDays = 0, String cutoff = ''}) => StoreConfig(
      siteName: config.siteName,
      tagline: '',
      logoUrl: '',
      currency: 'INR',
      deliveryFee: 99,
      freeDeliveryThreshold: 999,
      minOrderValue: 0,
      useZoneBasedDelivery: true,
      deliveryLeadDays: leadDays,
      sameDayCutoff: cutoff,
      deliveryTimeSlots: const [],
      deliveryTiers: const [],
      giftWrapEnabled: false,
      giftWrapFee: 0,
      giftWrapLabel: '',
      checkoutTerms: '',
      paymentMethods: config.paymentMethods,
      maintenanceEnabled: false,
      maintenanceMessage: '',
    );

    void withShop(StoreConfig? shopConfig) => when(
      () => store.state,
    ).thenReturn(StoreConfigState(status: ViewStatus.success, config: shopConfig));

    /// The shop's today plus [days], as the widget prints a later day.
    String dayAfter(int days) {
      final now = const ShopClock('Asia/Kolkata').now();
      return DateFormatter.shortDay(DateTime(now.year, now.month, now.day + days));
    }

    testWidgets('no cutoff and no lead time: Today', (tester) async {
      withShop(shop());
      given(const DeliveryAreaState());
      await pump(tester, const EarliestDeliveryText());
      expect(find.text('Earliest delivery: Today'), findsOneWidget);
    });

    testWidgets('a one-day lead time: Tomorrow', (tester) async {
      withShop(shop(leadDays: 1));
      given(const DeliveryAreaState());
      await pump(tester, const EarliestDeliveryText());
      expect(find.text('Earliest delivery: Tomorrow'), findsOneWidget);
    });

    testWidgets('a longer lead time: the date', (tester) async {
      withShop(shop(leadDays: 3));
      given(const DeliveryAreaState());
      await pump(tester, const EarliestDeliveryText());
      expect(find.text('Earliest delivery: ${dayAfter(3)}'), findsOneWidget);
    });

    testWidgets("the chosen area's own days push it out", (tester) async {
      withShop(shop(leadDays: 1));
      given(
        const DeliveryAreaState(
          status: DeliveryAreaStatus.delivers,
          area: DeliveryArea(
            pincode: '324002',
            verdict: DeliveryVerdict.eligible,
            minDeliveryDays: 4,
          ),
        ),
      );
      await pump(tester, const EarliestDeliveryText());
      expect(find.text('Earliest delivery: ${dayAfter(4)}'), findsOneWidget);
    });

    testWidgets('nothing until the shop settings are in', (tester) async {
      withShop(null);
      given(const DeliveryAreaState());
      await pump(tester, const EarliestDeliveryText());
      expect(find.textContaining(DeliveryAreaStrings.earliestDelivery), findsNothing);
    });

    testWidgets('nothing for a PIN code the shop does not deliver to', (tester) async {
      withShop(shop());
      given(const DeliveryAreaState(status: DeliveryAreaStatus.notDelivered, area: mumbai));
      await pump(tester, const EarliestDeliveryText());
      expect(find.textContaining(DeliveryAreaStrings.earliestDelivery), findsNothing);
    });

    testWidgets('takes the caller style', (tester) async {
      withShop(shop());
      given(const DeliveryAreaState());
      const style = TextStyle(fontSize: 21);
      await pump(tester, const EarliestDeliveryText(style: style));
      expect(tester.widget<Text>(find.byType(Text)).style, style);
    });
  });
}
