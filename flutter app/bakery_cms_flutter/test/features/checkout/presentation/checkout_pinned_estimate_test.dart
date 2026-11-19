import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/address_field.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_result.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/repositories/payment_gateway.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/check_delivery_pin.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/estimate_quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order.dart';
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

/// D9: once the pin is eligible and the address complete, the running total
/// becomes the exact one, priced WITH the address and pin (the zone's own
/// charge). It falls back to the address-less total when that stops holding.
void main() {
  late _MockEstimateQuote estimateQuote;
  late _MockCheckDeliveryPin checkDeliveryPin;
  late _MockPlaceOrder placeOrder;
  late _MockGateway gateway;

  /// The fixture's address, before any pin was dropped.
  const unpinned = CheckoutAddress(
    fullName: 'Asha Verma',
    email: 'asha@example.com',
    phone: '9876543210',
    addressLine1: '12 Park Road',
    city: 'Kota',
    state: 'Rajasthan',
    pincode: '324001',
  );

  const outside = PinCheckResult(status: PinStatus.outside, message: 'Outside our areas');

  /// How long typing must stop in these tests.
  const pause = Duration(milliseconds: 40);

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
    when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote));
    when(() => checkDeliveryPin(any())).thenAnswer((_) async => const Right(eligiblePin));
  });

  CheckoutBloc build() => CheckoutBloc(
        estimateQuote: estimateQuote,
        checkDeliveryPin: checkDeliveryPin,
        placeOrder: placeOrder,
        paymentGateway: gateway,
        newOrderId: () => 'order-uuid',
        clock: () => morning,
        addressPause: pause,
      );

  CheckoutState form(CheckoutAddress filled) => CheckoutState(
        setupStatus: ViewStatus.success,
        items: cart.items,
        zonesRequired: true,
        tierRequired: true,
        tiers: const [standard],
        tierId: 'standard',
        address: filled,
        estimateStatus: ViewStatus.success,
        quote: quote,
      );

  List<QuoteRequest> requests() =>
      verify(() => estimateQuote(captureAny())).captured.cast<QuoteRequest>();

  /// Pin [door] on [filled] and wait for whatever estimate that starts.
  Future<void> pin(CheckoutBloc bloc) async {
    bloc.add(const CheckoutLocationPicked(door));
    await bloc.stream.firstWhere((s) => !s.pinStatus.isLoading);
    await Future<void>.delayed(pause * 2);
  }

  group('when it prices WITH the address', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'an eligible pin on a complete address asks for the exact total',
      build: build,
      seed: () => form(unpinned),
      act: pin,
      verify: (bloc) {
        final request = requests().single;
        expect(request.address, isNotNull);
        expect(request.address!.location, door, reason: 'the pin goes with it');
        expect(request.address!.addressLine1, '12 Park Road');
        expect(request.pincode, isNull, reason: 'not the address-less estimate');
        expect(request.deliveryTierId, 'standard');
        expect(bloc.state.estimateStatus, ViewStatus.success);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'once exact, other re-prices (gift wrap) stay exact',
      build: build,
      seed: () => form(unpinned),
      act: (bloc) async {
        await pin(bloc);
        bloc.add(const CheckoutGiftWrapToggled(true));
        await bloc.stream.firstWhere((s) => s.estimateStatus.isSuccess && s.giftWrap);
      },
      verify: (_) {
        final sent = requests();
        expect(sent, hasLength(2));
        expect(sent.last.address, isNotNull);
        expect(sent.last.giftWrap, isTrue);
      },
    );
  });

  group('when it does NOT', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'a required field missing (email) keeps the address-less total',
      build: build,
      seed: () => form(const CheckoutAddress(fullName: 'Asha', phone: '9876543210', addressLine1: '12 Park Road')),
      act: pin,
      verify: (_) {
        // The pin filled city, state and PIN: one re-price for the new PIN.
        final request = requests().single;
        expect(request.address, isNull);
        expect(request.pincode, '324001');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'an invalid phone keeps the address-less total',
      build: build,
      seed: () => form(unpinned.copyWith(phone: '12345')),
      act: pin,
      verify: (_) => verifyNever(() => estimateQuote(any())),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a pin outside the delivery areas never asks for the exact total',
      setUp: () => when(() => checkDeliveryPin(any())).thenAnswer((_) async => const Right(outside)),
      build: build,
      seed: () => form(unpinned),
      act: pin,
      verify: (_) => verifyNever(() => estimateQuote(any())),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a complete address with no pin yet stays address-less, even when re-priced',
      build: build,
      seed: () => form(unpinned),
      act: (bloc) async {
        bloc.add(const CheckoutGiftWrapToggled(true));
        await bloc.stream.firstWhere((s) => s.estimateStatus.isSuccess);
      },
      verify: (_) => expect(requests().single.address, isNull),
    );
  });

  group('falling back', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'clearing a required field after an exact total goes back to the address-less one',
      build: build,
      seed: () => form(unpinned),
      act: (bloc) async {
        await pin(bloc);
        bloc.add(const CheckoutAddressFieldChanged(AddressField.phone, ''));
        await Future<void>.delayed(pause * 2);
      },
      verify: (_) {
        final sent = requests();
        expect(sent, hasLength(2));
        expect(sent.first.address, isNotNull);
        expect(sent.last.address, isNull);
        expect(sent.last.pincode, '324001');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a new pin that cannot be checked drops the exact total',
      build: build,
      seed: () => form(unpinned),
      act: (bloc) async {
        await pin(bloc);
        when(() => checkDeliveryPin(any())).thenAnswer((_) async => const Left(NetworkFailure()));
        await pin(bloc);
      },
      verify: (_) {
        final sent = requests();
        expect(sent, hasLength(2));
        expect(sent.last.address, isNull);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'filling the last missing field after the pin turns the total exact',
      build: build,
      seed: () => form(unpinned.copyWith(email: 'asha@')),
      act: (bloc) async {
        await pin(bloc);
        bloc.add(const CheckoutAddressFieldChanged(AddressField.email, 'asha@example.com'));
        await Future<void>.delayed(pause * 2);
      },
      verify: (_) {
        final sent = requests();
        expect(sent, hasLength(1), reason: 'the pin alone did not change the PIN code');
        expect(sent.single.address, isNotNull);
      },
    );
  });

  group('re-pricing while typing', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'a name edit does not change the price, so it does not re-price',
      build: build,
      seed: () => form(unpinned),
      act: (bloc) async {
        await pin(bloc);
        bloc.add(const CheckoutAddressFieldChanged(AddressField.fullName, 'Asha V.'));
        await Future<void>.delayed(pause * 2);
      },
      verify: (_) => expect(requests(), hasLength(1)),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'typing a city waits for the pause: one exact re-price, not one per letter',
      build: build,
      seed: () => form(unpinned),
      act: (bloc) async {
        await pin(bloc);
        // Each letter is handled before the next arrives, all well inside
        // the pause: no wall-clock gap a slow machine could stretch past it.
        for (final city in ['B', 'Bu', 'Bun', 'Bund', 'Bundi']) {
          bloc.add(CheckoutAddressFieldChanged(AddressField.city, city));
          await Future<void>.delayed(Duration.zero);
        }
        await Future<void>.delayed(pause * 2);
      },
      verify: (_) {
        final sent = requests();
        expect(sent, hasLength(2));
        expect(sent.last.address!.city, 'Bundi');
      },
    );
  });
}
