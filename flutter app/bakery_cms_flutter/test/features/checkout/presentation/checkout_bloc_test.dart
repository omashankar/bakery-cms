import 'package:bakery_cms_flutter/core/constants/strings/checkout_strings.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/repositories/payment_gateway.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/check_delivery_pin.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/estimate_quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order_params.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout_fixtures.dart';

class _MockEstimateQuote extends Mock implements EstimateQuote {}

class _MockCheckDeliveryPin extends Mock implements CheckDeliveryPin {}

class _MockPlaceOrder extends Mock implements PlaceOrder {}

class _MockGateway extends Mock implements PaymentGateway {}

void main() {
  late _MockEstimateQuote estimateQuote;
  late _MockCheckDeliveryPin checkDeliveryPin;
  late _MockPlaceOrder placeOrder;
  late _MockGateway gateway;

  const customer = Customer(id: 'c1', email: 'asha@example.com', name: 'Asha Verma', phone: '9876543210');

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
    when(() => gateway.isSupported).thenReturn(true);
  });

  CheckoutBloc build() => CheckoutBloc(
        estimateQuote: estimateQuote,
        checkDeliveryPin: checkDeliveryPin,
        placeOrder: placeOrder,
        paymentGateway: gateway,
        newOrderId: () => 'order-uuid',
        clock: () => morning,
      );

  /// A form ready to place: valid address with an eligible pin, a slot, COD.
  CheckoutState ready({CheckoutAddress filled = address}) => CheckoutState(
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
        address: filled,
        tierId: 'standard',
        date: DateTime(2026, 11, 16),
        timeSlot: '12:00 PM – 2:00 PM',
        paymentMethod: PaymentMethod.cod,
        pinStatus: ViewStatus.success,
        pinResult: eligiblePin,
        estimateStatus: ViewStatus.success,
        quote: quote,
      );

  group('CheckoutStarted', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'sets up from the shop and cart, prefills the customer, then prices the cart',
      setUp: () => when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote)),
      build: build,
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config, customer: customer)),
      expect: () => [
        isA<CheckoutState>()
            .having((s) => s.setupStatus, 'setupStatus', ViewStatus.success)
            .having((s) => s.tierId, 'default tier', 'standard')
            .having((s) => s.date, 'first date', DateTime(2026, 11, 16))
            .having((s) => s.windows, 'windows still open at 09:00', standard.windows)
            .having((s) => s.paymentMethod, 'online preferred', PaymentMethod.online)
            .having((s) => s.address.fullName, 'prefilled name', 'Asha Verma')
            .having((s) => s.zonesRequired, 'zonesRequired', isTrue),
        isA<CheckoutState>().having((s) => s.estimateStatus, 'estimate', ViewStatus.loading),
        isA<CheckoutState>()
            .having((s) => s.estimateStatus, 'estimate', ViewStatus.success)
            .having((s) => s.quote, 'quote', quote),
      ],
      verify: (_) {
        final request = verify(() => estimateQuote(captureAny())).captured.single as QuoteRequest;
        expect(request.address, isNull, reason: 'a running total never needs the map pin');
        expect(request.deliveryTierId, 'standard');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'reports a failed estimate inline, keeping the screen usable',
      setUp: () => when(() => estimateQuote(any()))
          .thenAnswer((_) async => const Left(ServerFailure('One of the items is no longer available.'))),
      build: build,
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config)),
      skip: 2,
      expect: () => [
        isA<CheckoutState>()
            .having((s) => s.estimateStatus, 'estimate', ViewStatus.failure)
            .having((s) => s.estimateError, 'error', 'One of the items is no longer available.')
            .having((s) => s.quote, 'quote', isNull),
      ],
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'without a payment SDK only cash on delivery is offered',
      setUp: () {
        when(() => gateway.isSupported).thenReturn(false);
        when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote));
      },
      build: build,
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config)),
      verify: (bloc) {
        expect(bloc.state.onlineAvailable, isFalse);
        expect(bloc.state.paymentMethod, PaymentMethod.cod);
      },
    );
  });

  group('choices', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'a new speed drops a slot it does not offer and re-prices',
      setUp: () => when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote)),
      build: build,
      seed: ready,
      act: (bloc) => bloc.add(const CheckoutTierSelected('midnight')),
      verify: (bloc) {
        expect(bloc.state.tierId, 'midnight');
        expect(bloc.state.windows, midnight.windows);
        expect(bloc.state.timeSlot, isNull);
        verify(() => estimateQuote(any())).called(1);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a rejected coupon is flagged once',
      setUp: () => when(() => estimateQuote(any())).thenAnswer(
        (_) async => const Right(Quote(draftId: 'd', totals: totals, rejectedCoupon: 'NOPE')),
      ),
      build: build,
      seed: ready,
      act: (bloc) => bloc.add(const CheckoutCouponApplied('NOPE')),
      verify: (bloc) {
        expect(bloc.state.couponRejected, isTrue);
        expect(bloc.state.couponCode, 'NOPE');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a picked pin is checked and fills the empty city, state and PIN',
      setUp: () {
        when(() => checkDeliveryPin(any())).thenAnswer((_) async => const Right(eligiblePin));
        when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote));
      },
      build: build,
      seed: () => ready(filled: const CheckoutAddress(fullName: 'Asha')).copyWith(pinResult: () => null),
      act: (bloc) => bloc.add(const CheckoutLocationPicked(door)),
      verify: (bloc) {
        expect(bloc.state.address.location, door);
        expect(bloc.state.pinResult, eligiblePin);
        expect(bloc.state.address.city, 'Kota');
        expect(bloc.state.address.pincode, '324001');
        verify(() => estimateQuote(any())).called(1);
      },
    );
  });

  group('CheckoutPlaceOrderPressed', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'places a cash-on-delivery order',
      setUp: () => when(() => placeOrder(any())).thenAnswer((_) async => const Right(confirmation)),
      build: build,
      seed: ready,
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      expect: () => [
        isA<CheckoutState>().having((s) => s.placeStatus, 'placing', ViewStatus.loading),
        isA<CheckoutState>()
            .having((s) => s.placeStatus, 'placed', ViewStatus.success)
            .having((s) => s.confirmation, 'confirmation', confirmation),
      ],
      verify: (_) {
        final params = verify(() => placeOrder(captureAny())).captured.single as PlaceOrderParams;
        expect(params.paymentMethod, PaymentMethod.cod);
        expect(params.address.location, door);
        expect(params.slot.timeSlot, '12:00 PM – 2:00 PM');
        expect(params.slot.tierLabel, 'Standard Delivery');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'surfaces the shop\'s refusal with the field it blamed',
      setUp: () => when(() => placeOrder(any())).thenAnswer(
        (_) async => const Left(
          ServerFailure('That delivery window has already passed today.', 'deliverySlot.timeSlot'),
        ),
      ),
      build: build,
      seed: ready,
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      expect: () => [
        isA<CheckoutState>().having((s) => s.placeStatus, 'placing', ViewStatus.loading),
        isA<CheckoutState>()
            .having((s) => s.placeStatus, 'failed', ViewStatus.failure)
            .having((s) => s.errorMessage, 'message', 'That delivery window has already passed today.')
            .having((s) => s.errorField, 'field', 'deliverySlot.timeSlot')
            .having((s) => s.confirmation, 'confirmation', isNull),
      ],
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'refuses without a map pin, before anything is sent',
      build: build,
      seed: () => ready(
        filled: const CheckoutAddress(
          fullName: 'Asha Verma',
          email: 'asha@example.com',
          phone: '9876543210',
          addressLine1: '12 Park Road',
          city: 'Kota',
          state: 'Rajasthan',
          pincode: '324001',
        ),
      ),
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      expect: () => [
        isA<CheckoutState>()
            .having((s) => s.errorMessage, 'message', CheckoutStrings.needPin)
            .having((s) => s.errorField, 'field', 'location')
            .having((s) => s.placeStatus, 'not placing', ViewStatus.initial),
      ],
      verify: (_) => verifyNever(() => placeOrder(any())),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'refuses without a time slot',
      build: build,
      seed: () => ready().copyWith(timeSlot: () => null),
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      expect: () => [
        isA<CheckoutState>().having((s) => s.errorMessage, 'message', CheckoutStrings.needSlot),
      ],
      verify: (_) => verifyNever(() => placeOrder(any())),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'the same refusal twice is shown twice',
      build: build,
      seed: () => ready().copyWith(paymentMethod: () => null),
      act: (bloc) => bloc
        ..add(const CheckoutPlaceOrderPressed())
        ..add(const CheckoutPlaceOrderPressed()),
      expect: () => [
        isA<CheckoutState>().having((s) => s.errorId, 'errorId', 1),
        isA<CheckoutState>().having((s) => s.errorId, 'errorId', 2),
      ],
    );
  });
}
