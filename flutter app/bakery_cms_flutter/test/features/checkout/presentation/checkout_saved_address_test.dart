import 'dart:async';

import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/address_book.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/saved_address.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/repositories/address_book_repository.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/load_address_book.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/usecases/remember_address.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/address_field.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/address_label.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_request.dart';
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

class _MockLoadAddressBook extends Mock implements LoadAddressBook {}

class _MockRememberAddress extends Mock implements RememberAddress {}

class _MockRepository extends Mock implements AddressBookRepository {}

/// Saved addresses at checkout: the default prefills the form, the chooser
/// fills it, and the address an order went to is kept for next time.
void main() {
  late _MockEstimateQuote estimateQuote;
  late _MockCheckDeliveryPin checkDeliveryPin;
  late _MockPlaceOrder placeOrder;
  late _MockGateway gateway;
  late _MockLoadAddressBook loadAddressBook;

  const customer = Customer(
    id: 'c1',
    email: 'asha@example.com',
    name: 'Asha Verma',
    phone: '9876543210',
  );

  const home = SavedAddress(
    id: 'home',
    label: 'Home',
    isDefault: true,
    addressLine1: '12 Park Road',
    landmark: 'Near the temple',
    city: 'Kota',
    state: 'Rajasthan',
    pincode: '324001',
  );

  const office = SavedAddress(
    id: 'office',
    label: 'Office',
    kind: AddressLabel.office,
    fullName: 'Asha at work',
    phone: '9000000001',
    addressLine1: '4 Mall Road',
    city: 'Kota',
    state: 'Rajasthan',
    pincode: '324005',
  );

  setUpAll(() {
    registerFallbackValue(QuoteRequest(items: cart.items));
    registerFallbackValue(const PinCheckRequest(location: door));
    registerFallbackValue(paramsFor(PaymentMethod.cod));
    registerFallbackValue(const SavedAddress());
    registerFallbackValue(const AddressBook());
  });

  setUp(() {
    estimateQuote = _MockEstimateQuote();
    checkDeliveryPin = _MockCheckDeliveryPin();
    placeOrder = _MockPlaceOrder();
    gateway = _MockGateway();
    loadAddressBook = _MockLoadAddressBook();
    when(() => gateway.isSupported).thenReturn(true);
    when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote));
    when(() => loadAddressBook()).thenAnswer(
      (_) async => const Right(AddressBook([office, home])),
    );
  });

  CheckoutBloc build({RememberAddress? remember}) => CheckoutBloc(
        estimateQuote: estimateQuote,
        checkDeliveryPin: checkDeliveryPin,
        placeOrder: placeOrder,
        paymentGateway: gateway,
        newOrderId: () => 'order-uuid',
        clock: () => morning,
        loadAddressBook: loadAddressBook,
        rememberAddress: remember,
        addressPause: Duration.zero,
      );

  Future<void> started(CheckoutBloc bloc) async {
    bloc.add(const CheckoutStarted(cart: cart, config: config, customer: customer));
    await bloc.stream.firstWhere((s) => s.savedAddresses.isNotEmpty);
  }

  group('prefill from the default', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'the default fills the form; the account fills the name, email and phone it lacks',
      build: build,
      act: started,
      verify: (bloc) {
        final a = bloc.state.address;
        expect(a.addressLine1, '12 Park Road');
        expect(a.landmark, 'Near the temple');
        expect(a.pincode, '324001');
        expect(a.fullName, 'Asha Verma', reason: 'the saved one has no name: the account\'s');
        expect(a.email, 'asha@example.com');
        expect(a.phone, '9876543210');
        expect(a.location, isNull, reason: 'a saved address has no pin; checkout still asks');
        expect(bloc.state.savedAddresses.map((s) => s.id), ['home', 'office'],
            reason: 'the chooser lists the default first');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      "the saved address's own name and phone win over the account's",
      setUp: () => when(() => loadAddressBook()).thenAnswer(
        (_) async => Right(AddressBook([office.copyWith(isDefault: true)])),
      ),
      build: build,
      act: started,
      verify: (bloc) {
        expect(bloc.state.address.fullName, 'Asha at work');
        expect(bloc.state.address.phone, '9000000001');
        expect(bloc.state.address.email, 'asha@example.com', reason: 'it has none of its own');
        expect(bloc.state.address.label, AddressLabel.office);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'the prefilled PIN prices the running total for that area',
      build: build,
      act: (bloc) async {
        await started(bloc);
        await bloc.stream.firstWhere((s) => s.estimateStatus.isSuccess);
      },
      verify: (_) {
        final requests = verify(() => estimateQuote(captureAny())).captured.cast<QuoteRequest>();
        expect(requests.last.pincode, '324001');
        expect(requests.last.address, isNull, reason: 'no pin yet, so no exact total');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'an address the customer already started is never overwritten',
      // The book answers after the customer has typed.
      setUp: () => when(() => loadAddressBook()).thenAnswer((_) async {
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return const Right(AddressBook([home]));
      }),
      build: build,
      act: (bloc) async {
        bloc
          ..add(const CheckoutStarted(cart: cart, config: config, customer: customer))
          ..add(const CheckoutAddressFieldChanged(AddressField.addressLine1, '77 New Street'));
        await bloc.stream.firstWhere((s) => s.savedAddresses.isNotEmpty);
      },
      verify: (bloc) {
        expect(bloc.state.address.addressLine1, '77 New Street');
        expect(bloc.state.address.pincode, '');
        expect(bloc.state.savedAddresses, hasLength(1), reason: 'still offered in the chooser');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a book that cannot be read leaves checkout as it was',
      setUp: () => when(() => loadAddressBook()).thenAnswer((_) async => const Left(NetworkFailure())),
      build: build,
      act: (bloc) async {
        bloc.add(const CheckoutStarted(cart: cart, config: config, customer: customer));
        await Future<void>.delayed(const Duration(milliseconds: 20));
      },
      verify: (bloc) {
        expect(bloc.state.savedAddresses, isEmpty);
        expect(bloc.state.address.addressLine1, '');
        expect(bloc.state.errorMessage, isNull, reason: 'silent: checkout works without it');
      },
    );
  });

  group('the chooser', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'choosing another saved address fills the form and drops the pin for the old place',
      setUp: () => when(() => loadAddressBook()).thenAnswer((_) async => const Right(AddressBook())),
      build: build,
      seed: () => CheckoutState(
        setupStatus: ViewStatus.success,
        items: cart.items,
        zonesRequired: true,
        address: address,
        pinStatus: ViewStatus.success,
        pinResult: eligiblePin,
        savedAddresses: const [home, office],
      ),
      act: (bloc) => bloc.add(const CheckoutSavedAddressChosen(office)),
      verify: (bloc) {
        expect(bloc.state.address.addressLine1, '4 Mall Road');
        expect(bloc.state.address.pincode, '324005');
        expect(bloc.state.address.location, isNull);
        expect(bloc.state.pinResult, isNull);
        expect(bloc.state.pinStatus, ViewStatus.initial);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'choosing the place already pinned keeps the pin',
      build: build,
      seed: () => CheckoutState(
        setupStatus: ViewStatus.success,
        items: cart.items,
        zonesRequired: true,
        address: address,
        pinStatus: ViewStatus.success,
        pinResult: eligiblePin,
        savedAddresses: const [home, office],
      ),
      act: (bloc) => bloc.add(const CheckoutSavedAddressChosen(home)),
      verify: (bloc) {
        expect(bloc.state.address.location, door);
        expect(bloc.state.pinResult, eligiblePin);
      },
    );
  });

  group('saved after the order', () {
    late _MockRepository repository;

    setUp(() {
      repository = _MockRepository();
      when(() => repository.save(any())).thenAnswer(
        (invocation) async => Right(invocation.positionalArguments.single as AddressBook),
      );
      when(() => placeOrder(any())).thenAnswer((_) async => const Right(confirmation));
    });

    CheckoutState readyToPlace(CheckoutAddress filled) => CheckoutState(
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

    Future<void> placed(CheckoutBloc bloc) async {
      bloc.add(const CheckoutPlaceOrderPressed());
      await bloc.stream.firstWhere((s) => s.confirmation != null);
      await Future<void>.delayed(Duration.zero);
    }

    blocTest<CheckoutBloc, CheckoutState>(
      'a new place is saved, without the pin, and as the default into an empty book',
      setUp: () => when(() => repository.load()).thenAnswer((_) async => const Right(AddressBook())),
      build: () => build(remember: RememberAddress(repository, newId: () => 'kept')),
      seed: () => readyToPlace(address),
      act: placed,
      verify: (_) {
        final book = verify(() => repository.save(captureAny())).captured.single as AddressBook;
        final kept = book.addresses.single;
        expect(kept.addressLine1, '12 Park Road');
        expect(kept.pincode, '324001');
        expect(kept.fullName, 'Asha Verma');
        expect(kept.isDefault, isTrue);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a place already saved (different case) is not saved again',
      setUp: () => when(() => repository.load()).thenAnswer(
        (_) async => const Right(
          AddressBook([SavedAddress(id: 'h', isDefault: true, addressLine1: '12 PARK ROAD', pincode: '324001')]),
        ),
      ),
      build: () => build(remember: RememberAddress(repository, newId: () => 'kept')),
      seed: () => readyToPlace(address),
      act: placed,
      verify: (_) => verifyNever(() => repository.save(any())),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'saving never holds up the success screen, even if it never answers',
      build: () {
        final remember = _MockRememberAddress();
        when(() => remember(any())).thenAnswer((_) => Completer<Never>().future);
        return build(remember: remember);
      },
      seed: () => readyToPlace(address),
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      expect: () => [
        isA<CheckoutState>().having((s) => s.placeStatus, 'placing', ViewStatus.loading),
        isA<CheckoutState>()
            .having((s) => s.placeStatus, 'placed', ViewStatus.success)
            .having((s) => s.confirmation, 'confirmation', confirmation),
      ],
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a save that throws is swallowed: the order still succeeds',
      build: () {
        final remember = _MockRememberAddress();
        when(() => remember(any())).thenThrow(StateError('boom'));
        return build(remember: remember);
      },
      seed: () => readyToPlace(address),
      act: placed,
      verify: (bloc) => expect(bloc.state.confirmation, confirmation),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a refused order saves nothing',
      setUp: () {
        when(() => repository.load()).thenAnswer((_) async => const Right(AddressBook()));
        when(() => placeOrder(any())).thenAnswer((_) async => const Left(NetworkFailure()));
      },
      build: () => build(remember: RememberAddress(repository, newId: () => 'kept')),
      seed: () => readyToPlace(address),
      act: (bloc) async {
        bloc.add(const CheckoutPlaceOrderPressed());
        await bloc.stream.firstWhere((s) => s.placeStatus.isFailure);
      },
      verify: (_) => verifyNever(() => repository.save(any())),
    );
  });
}
