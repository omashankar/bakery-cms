import 'package:bakery_cms_flutter/core/constants/strings/checkout_strings.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_result.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/applied_coupon.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/paid_but_unconfirmed_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/price_change_reason.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/price_changed_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/repositories/payment_gateway.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/check_delivery_pin.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/estimate_quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order_params.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_state.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/coupon_status.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order_totals.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout_fixtures.dart';

class _MockEstimateQuote extends Mock implements EstimateQuote {}

class _MockCheckDeliveryPin extends Mock implements CheckDeliveryPin {}

class _MockPlaceOrder extends Mock implements PlaceOrder {}

class _MockGateway extends Mock implements PaymentGateway {}

/// Review findings on the checkout bloc: one order id per checkout, the lock
/// after a payment, the price-changed stop, the shop's clock and the area's
/// own preparation days.
void main() {
  late _MockEstimateQuote estimateQuote;
  late _MockCheckDeliveryPin checkDeliveryPin;
  late _MockPlaceOrder placeOrder;
  late _MockGateway gateway;
  late int minted;

  setUpAll(() {
    registerFallbackValue(QuoteRequest(items: cart.items));
    registerFallbackValue(const PinCheckRequest(location: door));
    registerFallbackValue(paramsFor(PaymentMethod.cod));
  });

  setUp(() {
    estimateQuote = _MockEstimateQuote();
    checkDeliveryPin = _MockCheckDeliveryPin();
    placeOrder = _MockPlaceOrder();
    gateway = _MockGateway();
    minted = 0;
    when(() => gateway.isSupported).thenReturn(true);
    when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote));
  });

  CheckoutBloc build({DateTime Function()? clock, DateTime Function()? instant}) => CheckoutBloc(
        estimateQuote: estimateQuote,
        checkDeliveryPin: checkDeliveryPin,
        placeOrder: placeOrder,
        paymentGateway: gateway,
        newOrderId: () => 'id-${++minted}',
        clock: clock ?? (instant == null ? () => morning : null),
        instant: instant ?? DateTime.now,
      );

  CheckoutState ready() => CheckoutState(
        setupStatus: ViewStatus.success,
        termsAccepted: true,
        items: cart.items,
        shopName: config.siteName,
        zonesRequired: true,
        tierRequired: true,
        tiers: const [standard, midnight],
        dates: [DateTime(2026, 11, 16)],
        windows: standard.windows,
        codAvailable: true,
        onlineAvailable: true,
        address: address,
        tierId: 'standard',
        date: DateTime(2026, 11, 16),
        timeSlot: '12:00 PM – 2:00 PM',
        paymentMethod: PaymentMethod.cod,
        pinStatus: ViewStatus.success,
        pinResult: eligiblePin,
        estimateStatus: ViewStatus.success,
        quote: quote,
      );

  List<PlaceOrderParams> sent() =>
      verify(() => placeOrder(captureAny())).captured.cast<PlaceOrderParams>();

  group('one order id per checkout', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'a second press after a lost answer re-sends the SAME id',
      setUp: () {
        var calls = 0;
        when(() => placeOrder(any())).thenAnswer((_) async {
          calls++;
          return calls == 1 ? const Left(NetworkFailure()) : const Right(confirmation);
        });
      },
      build: build,
      seed: ready,
      act: (bloc) async {
        bloc.add(const CheckoutPlaceOrderPressed());
        await bloc.stream.firstWhere((s) => s.placeStatus.isFailure);
        bloc.add(const CheckoutPlaceOrderPressed());
        await bloc.stream.firstWhere((s) => s.placeStatus.isSuccess);
      },
      verify: (_) {
        final ids = sent().map((p) => p.orderId).toList();
        expect(ids, ['id-1', 'id-1']);
        expect(minted, 1);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'the total the customer was shown goes with the order',
      setUp: () => when(() => placeOrder(any())).thenAnswer((_) async => const Right(confirmation)),
      build: build,
      seed: ready,
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      verify: (_) => expect(sent().single.expectedTotal, quote.totals.total),
    );
  });

  group('paid but not confirmed', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'locks checkout: no snackbar, and Pay does nothing afterwards',
      setUp: () => when(() => placeOrder(any()))
          .thenAnswer((_) async => Left(PaidButUnconfirmedFailure(paymentId: 'pay_9'))),
      build: build,
      seed: ready,
      act: (bloc) async {
        bloc.add(const CheckoutPlaceOrderPressed());
        await bloc.stream.firstWhere((s) => s.isLocked);
        bloc.add(const CheckoutPlaceOrderPressed());
      },
      verify: (bloc) {
        expect(bloc.state.isLocked, isTrue);
        expect(bloc.state.paidNotice, contains('pay_9'));
        expect(bloc.state.errorMessage, isNull, reason: 'a dialog, not a vanishing snackbar');
        verify(() => placeOrder(any())).called(1);
      },
    );
  });

  group('price changed', () {
    const dearer = OrderTotals(
      subtotal: 999,
      delivery: 149,
      tax: 49.95,
      discount: 0,
      platformCharge: 0,
      giftWrapFee: 0,
      deliveryTierFee: 0,
      total: 1197.95,
      itemCount: 1,
    );
    const newQuote = Quote(draftId: 'draft-2', totals: dearer);

    blocTest<CheckoutBloc, CheckoutState>(
      'shows the new total, and the next press confirms THAT total',
      setUp: () {
        var calls = 0;
        when(() => placeOrder(any())).thenAnswer((_) async {
          calls++;
          return calls == 1
              ? Left(PriceChangedFailure(quote: newQuote, reason: PriceChangeReason.totalChanged))
              : const Right(confirmation);
        });
      },
      build: build,
      seed: ready,
      act: (bloc) async {
        bloc.add(const CheckoutPlaceOrderPressed());
        await bloc.stream.firstWhere((s) => s.quote == newQuote);
        bloc.add(const CheckoutPlaceOrderPressed());
        await bloc.stream.firstWhere((s) => s.placeStatus.isSuccess);
      },
      verify: (bloc) {
        final params = sent();
        expect(params.first.expectedTotal, 1048.95);
        expect(params.last.expectedTotal, 1197.95);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'the message names the new price',
      setUp: () => when(() => placeOrder(any())).thenAnswer(
        (_) async => Left(PriceChangedFailure(quote: newQuote, reason: PriceChangeReason.totalChanged)),
      ),
      build: build,
      seed: ready,
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      skip: 1,
      expect: () => [
        isA<CheckoutState>()
            .having((s) => s.errorMessage, 'message', contains('1,197.95'))
            .having((s) => s.errorMessage, 'message', contains(CheckoutStrings.priceChangedTotal))
            .having((s) => s.placeStatus, 'not a failure', ViewStatus.initial)
            .having((s) => s.quote, 'new quote', newQuote),
      ],
    );
  });

  group("the shop's clock", () {
    blocTest<CheckoutBloc, CheckoutState>(
      'a phone at 20:00 UTC is already the 17th in Kota',
      build: () => build(instant: () => DateTime.utc(2026, 11, 16, 20)),
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config)),
      verify: (bloc) {
        expect(bloc.state.dates.first, DateTime(2026, 11, 17));
        expect(bloc.state.date, DateTime(2026, 11, 17));
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      "past the shop's 14:00 cutoff (14:30 IST), today is not offered",
      build: () => build(instant: () => DateTime.utc(2026, 11, 16, 9)),
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config)),
      verify: (bloc) => expect(bloc.state.dates.first, DateTime(2026, 11, 17)),
    );
  });

  group("the area's own preparation days", () {
    const slowArea = PinCheckResult(
      status: PinStatus.eligible,
      charge: 99,
      city: 'Kota',
      state: 'Rajasthan',
      postalCode: '324001',
      minDeliveryDays: 3,
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a pin in an area needing 3 days moves the first date on',
      setUp: () => when(() => checkDeliveryPin(any())).thenAnswer((_) async => const Right(slowArea)),
      build: build,
      act: (bloc) async {
        bloc.add(const CheckoutStarted(cart: cart, config: config));
        await bloc.stream.firstWhere((s) => s.setupStatus.isSuccess);
        bloc.add(const CheckoutLocationPicked(door));
        await bloc.stream.firstWhere((s) => s.pinStatus.isSuccess);
      },
      verify: (bloc) {
        expect(bloc.state.dates.first, DateTime(2026, 11, 19));
        expect(bloc.state.date, DateTime(2026, 11, 19), reason: 'the 16th is no longer bookable');
      },
    );
  });

  group('coupon status', () {
    CheckoutState withCoupon({
      required ViewStatus estimate,
      Quote? priced,
      bool rejected = false,
    }) =>
        ready().copyWith(
          couponCode: () => 'BDAY20',
          couponRejected: rejected,
          estimateStatus: estimate,
          quote: () => priced,
        );

    const confirmed = Quote(
      draftId: 'd',
      totals: totals,
      coupon: AppliedCoupon(code: 'BDAY20', label: '', discountAmount: 100),
    );

    test('applied only once a quote carries it', () {
      expect(withCoupon(estimate: ViewStatus.success, priced: confirmed).couponStatus,
          CouponStatus.applied);
      expect(withCoupon(estimate: ViewStatus.success, priced: quote).couponStatus,
          CouponStatus.unconfirmed);
    });

    test('while pricing it is being checked, and a failed pricing is not applied', () {
      expect(withCoupon(estimate: ViewStatus.loading).couponStatus, CouponStatus.checking);
      expect(withCoupon(estimate: ViewStatus.failure, priced: confirmed).couponStatus,
          CouponStatus.unconfirmed);
    });

    test('refused stays refused', () {
      expect(withCoupon(estimate: ViewStatus.success, rejected: true).couponStatus,
          CouponStatus.rejected);
      expect(ready().couponStatus, CouponStatus.none);
    });
  });

  test('a filled address is still valid for the lock tests', () {
    expect(address, isA<CheckoutAddress>());
  });
}
