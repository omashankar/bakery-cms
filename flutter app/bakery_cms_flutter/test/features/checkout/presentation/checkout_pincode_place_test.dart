import 'dart:async';

import 'package:bakery_cms_flutter/core/error/network_failure.dart';
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
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/pincode_place.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/usecases/find_pincode_place.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout_fixtures.dart';

class _MockEstimateQuote extends Mock implements EstimateQuote {}

class _MockCheckDeliveryPin extends Mock implements CheckDeliveryPin {}

class _MockPlaceOrder extends Mock implements PlaceOrder {}

class _MockGateway extends Mock implements PaymentGateway {}

class _MockFindPincodePlace extends Mock implements FindPincodePlace {}

/// A full PIN in checkout's address fills City and State from India Post's
/// directory, the website checkout's rule: into the boxes left EMPTY, never
/// over what the customer typed, and silently when the directory is down.
void main() {
  late _MockEstimateQuote estimateQuote;
  late _MockFindPincodePlace find;

  const pause = Duration(milliseconds: 30);
  const kota = PincodePlace(pincode: '324001', state: 'Rajasthan', districts: ['Kota', 'Bundi']);

  setUpAll(() {
    registerFallbackValue(QuoteRequest(items: cart.items));
    registerFallbackValue(const PinCheckRequest(location: door));
    registerFallbackValue(paramsFor(PaymentMethod.cod));
  });

  setUp(() {
    estimateQuote = _MockEstimateQuote();
    find = _MockFindPincodePlace();
    when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote));
    when(() => find('324001')).thenAnswer((_) async => const Right(kota));
  });

  CheckoutBloc build() {
    final gateway = _MockGateway();
    when(() => gateway.isSupported).thenReturn(true);
    return CheckoutBloc(
      estimateQuote: estimateQuote,
      checkDeliveryPin: _MockCheckDeliveryPin(),
      placeOrder: _MockPlaceOrder(),
      paymentGateway: gateway,
      newOrderId: () => 'order-uuid',
      clock: () => morning,
      findPincodePlace: find,
      addressPause: Duration.zero,
      pincodePause: pause,
    );
  }

  Future<void> settle() => Future<void>.delayed(pause * 4);

  Future<CheckoutBloc> started() async {
    final bloc = build();
    bloc.add(const CheckoutStarted(cart: cart, config: config));
    await settle();
    return bloc;
  }

  void type(CheckoutBloc bloc, AddressField field, String value) =>
      bloc.add(CheckoutAddressFieldChanged(field, value));

  test('a typed PIN fills an empty City (its first district) and State', () async {
    final bloc = await started();
    type(bloc, AddressField.pincode, '324001');
    await settle();

    expect(bloc.state.address.city, 'Kota');
    expect(bloc.state.address.state, 'Rajasthan');
    verify(() => find('324001')).called(1);
    await bloc.close();
  });

  test('what the customer typed stays theirs: only the empty box is filled', () async {
    final bloc = await started();
    type(bloc, AddressField.city, 'Kota Junction');
    type(bloc, AddressField.pincode, '324001');
    await settle();

    expect(bloc.state.address.city, 'Kota Junction');
    expect(bloc.state.address.state, 'Rajasthan');
    await bloc.close();
  });

  test('typing a PIN digit by digit asks once, for the full PIN, after the pause', () async {
    final bloc = await started();
    for (final typed in ['3', '32', '324', '3240', '32400', '324001']) {
      type(bloc, AddressField.pincode, typed);
    }
    await Future<void>.delayed(pause ~/ 2);
    verifyNever(() => find(any()));
    await settle();

    verify(() => find('324001')).called(1);
    await bloc.close();
  });

  test('a PIN changed before the answer lands is not filled from the old one', () async {
    final slow = Completer<Either<NetworkFailure, PincodePlace?>>();
    when(() => find('324001')).thenAnswer((_) => slow.future);
    when(() => find('324002')).thenAnswer((_) async => const Right(null));
    final bloc = await started();
    type(bloc, AddressField.pincode, '324001');
    await settle(); // asked, and waiting on the directory
    type(bloc, AddressField.pincode, '324002');
    slow.complete(const Right(kota));
    await settle();

    expect(bloc.state.address.city, isEmpty);
    expect(bloc.state.address.state, isEmpty);
    await bloc.close();
  });

  test('no directory, or a PIN it does not list: nothing filled, nothing said', () async {
    when(() => find('324001')).thenAnswer((_) async => const Left(NetworkFailure()));
    when(() => find('999999')).thenAnswer((_) async => const Right(null));
    final bloc = await started();
    type(bloc, AddressField.pincode, '324001');
    await settle();
    type(bloc, AddressField.pincode, '999999');
    await settle();

    expect(bloc.state.address.city, isEmpty);
    expect(bloc.state.address.state, isEmpty);
    expect(bloc.state.errorMessage, isNull);
    await bloc.close();
  });

  test('the PIN filled from the delivery area at start is looked up too', () async {
    final bloc = build();
    bloc.add(const CheckoutStarted(cart: cart, config: config, deliveryPincode: '324001'));
    await settle();

    expect(bloc.state.address.pincode, '324001');
    expect(bloc.state.address.city, 'Kota');
    expect(bloc.state.address.state, 'Rajasthan');
    await bloc.close();
  });
}
