import 'dart:async';

import 'package:bakery_cms_flutter/core/error/failure.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/address_book.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/saved_address.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/load_address_book.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/address_field.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/repositories/payment_gateway.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/check_delivery_pin.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/estimate_quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout_fixtures.dart';

class _MockEstimateQuote extends Mock implements EstimateQuote {}

class _MockCheckDeliveryPin extends Mock implements CheckDeliveryPin {}

class _MockPlaceOrder extends Mock implements PlaceOrder {}

class _MockGateway extends Mock implements PaymentGateway {}

class _MockLoadAddressBook extends Mock implements LoadAddressBook {}

/// The delivery PIN code chosen on the home page fills an empty checkout
/// PIN field, as the weakest source: a saved address replaces it, and it
/// never replaces anything the customer typed.
void main() {
  late _MockEstimateQuote estimateQuote;
  late _MockLoadAddressBook loadAddressBook;

  const home = SavedAddress(
    id: 'home',
    label: 'Home',
    isDefault: true,
    addressLine1: '12 Park Road',
    city: 'Kota',
    state: 'Rajasthan',
    pincode: '324001',
  );

  setUpAll(() {
    registerFallbackValue(QuoteRequest(items: cart.items));
    registerFallbackValue(const PinCheckRequest(location: door));
    registerFallbackValue(paramsFor(PaymentMethod.cod));
  });

  setUp(() {
    estimateQuote = _MockEstimateQuote();
    loadAddressBook = _MockLoadAddressBook();
    when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote));
  });

  CheckoutBloc build({bool withBook = true}) {
    final gateway = _MockGateway();
    when(() => gateway.isSupported).thenReturn(true);
    return CheckoutBloc(
      estimateQuote: estimateQuote,
      checkDeliveryPin: _MockCheckDeliveryPin(),
      placeOrder: _MockPlaceOrder(),
      paymentGateway: gateway,
      newOrderId: () => 'order-uuid',
      clock: () => morning,
      loadAddressBook: withBook ? loadAddressBook : null,
      addressPause: Duration.zero,
    );
  }

  /// Lets the queued events (estimate, address book) run.
  Future<void> settle() => Future<void>.delayed(const Duration(milliseconds: 20));

  test(
    'no saved address: the chosen PIN code fills the empty field and prices the total',
    () async {
      final bloc = build(withBook: false);
      bloc.add(const CheckoutStarted(cart: cart, config: config, deliveryPincode: '324002'));
      await settle();

      expect(bloc.state.address.pincode, '324002');
      final asked = verify(() => estimateQuote(captureAny())).captured.last as QuoteRequest;
      expect(asked.pincode, '324002');
      await bloc.close();
    },
  );

  test('an empty address book leaves the chosen PIN code in place', () async {
    when(() => loadAddressBook()).thenAnswer((_) async => const Right(AddressBook()));
    final bloc = build();
    bloc.add(const CheckoutStarted(cart: cart, config: config, deliveryPincode: '324002'));
    await settle();
    expect(bloc.state.address.pincode, '324002');
    await bloc.close();
  });

  test('a saved default address wins over the chosen PIN code', () async {
    when(() => loadAddressBook()).thenAnswer((_) async => const Right(AddressBook([home])));
    final bloc = build();
    bloc.add(const CheckoutStarted(cart: cart, config: config, deliveryPincode: '324002'));
    await settle();

    expect(bloc.state.address.addressLine1, '12 Park Road');
    expect(bloc.state.address.pincode, '324001');
    await bloc.close();
  });

  test('a PIN code typed before the book arrives is kept: neither source replaces it', () async {
    final book = Completer<Either<Failure, AddressBook>>();
    when(() => loadAddressBook()).thenAnswer((_) => book.future);
    final bloc = build();
    bloc.add(const CheckoutStarted(cart: cart, config: config, deliveryPincode: '324002'));
    await settle();
    expect(bloc.state.address.pincode, '324002');

    bloc.add(const CheckoutAddressFieldChanged(AddressField.pincode, '324005'));
    await settle();
    book.complete(const Right(AddressBook([home])));
    await settle();

    expect(bloc.state.address.pincode, '324005');
    expect(bloc.state.address.addressLine1, isEmpty);
    await bloc.close();
  });

  test('without a chosen PIN code the field stays empty', () async {
    final bloc = build(withBook: false);
    bloc.add(const CheckoutStarted(cart: cart, config: config));
    await settle();
    expect(bloc.state.address.pincode, isEmpty);
    await bloc.close();
  });

  test('a chosen PIN code that is not a valid PIN is not filled in', () async {
    final bloc = build(withBook: false);
    bloc.add(const CheckoutStarted(cart: cart, config: config, deliveryPincode: '02400'));
    await settle();
    expect(bloc.state.address.pincode, isEmpty);
    await bloc.close();
  });
}
