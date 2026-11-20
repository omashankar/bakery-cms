import 'package:bakery_cms_flutter/core/constants/strings/checkout_strings.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_catalog.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_catalog_entry.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_result.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_found.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/repositories/payment_gateway.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/check_delivery_pin.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/check_online_payment.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/estimate_quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/get_checkout_catalog.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order_params.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_state.dart';
import 'package:bakery_cms_flutter/features/offers/domain/entities/offer_cart_line.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/cancellation_class.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order_totals.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/payment_methods.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout_fixtures.dart';

class _MockEstimateQuote extends Mock implements EstimateQuote {}

class _MockCheckDeliveryPin extends Mock implements CheckDeliveryPin {}

class _MockPlaceOrder extends Mock implements PlaceOrder {}

class _MockGateway extends Mock implements PaymentGateway {}

class _MockCheckOnlinePayment extends Mock implements CheckOnlinePayment {}

class _MockGetCheckoutCatalog extends Mock implements GetCheckoutCatalog {}

/// The checkout rules the website enforces and the app now follows: the
/// consent tick, the minimum order, maintenance, the gateway's availability,
/// cash on delivery from the live catalogue, the "Use PIN" fix, and no
/// second quote for the same body.
void main() {
  late _MockEstimateQuote estimateQuote;
  late _MockCheckDeliveryPin checkDeliveryPin;
  late _MockPlaceOrder placeOrder;
  late _MockGateway gateway;
  late _MockCheckOnlinePayment checkOnlinePayment;
  late _MockGetCheckoutCatalog getCheckoutCatalog;

  final pressedAt = DateTime.utc(2026, 11, 16, 3, 30, 5, 120);
  const customer = Customer(
    id: 'c1',
    email: 'asha@example.com',
    name: 'Asha Verma',
    phone: '9876543210',
  );

  setUpAll(() {
    registerFallbackValue(QuoteRequest(items: cart.items));
    registerFallbackValue(const PinCheckRequest(location: door));
    registerFallbackValue(paramsFor(PaymentMethod.cod));
    registerFallbackValue(const NoParams());
  });

  setUp(() {
    estimateQuote = _MockEstimateQuote();
    checkDeliveryPin = _MockCheckDeliveryPin();
    placeOrder = _MockPlaceOrder();
    gateway = _MockGateway();
    checkOnlinePayment = _MockCheckOnlinePayment();
    getCheckoutCatalog = _MockGetCheckoutCatalog();
    when(() => gateway.isSupported).thenReturn(true);
    when(() => estimateQuote(any())).thenAnswer((_) async => const Right(quote));
    when(() => placeOrder(any())).thenAnswer((_) async => const Right(confirmation));
  });

  CheckoutBloc build({bool withServices = false}) => CheckoutBloc(
    estimateQuote: estimateQuote,
    checkDeliveryPin: checkDeliveryPin,
    placeOrder: placeOrder,
    paymentGateway: gateway,
    newOrderId: () => 'order-uuid',
    clock: () => morning,
    instant: () => pressedAt,
    checkOnlinePayment: withServices ? checkOnlinePayment : null,
    getCheckoutCatalog: withServices ? getCheckoutCatalog : null,
  );

  CheckoutState ready({bool terms = true, double minOrderValue = 0, String? closed}) =>
      CheckoutState(
        setupStatus: ViewStatus.success,
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
        termsAccepted: terms,
        minOrderValue: minOrderValue,
        maintenanceNotice: closed,
      );

  PlaceOrderParams placed() =>
      verify(() => placeOrder(captureAny())).captured.single as PlaceOrderParams;

  group('the consent tick', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'unticked, Place order refuses before anything is priced, and says why under the box',
      build: build,
      seed: () => ready(terms: false),
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      expect: () => [
        isA<CheckoutState>()
            .having((s) => s.termsError, 'inline', CheckoutStrings.acceptTerms)
            .having((s) => s.errorField, 'field', CheckoutBloc.termsField)
            .having((s) => s.placeStatus, 'not placing', ViewStatus.initial),
      ],
      verify: (_) => verifyNever(() => placeOrder(any())),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'ticking clears the refusal, and the order then carries the moment of the press',
      build: build,
      seed: () => ready(terms: false).copyWith(termsError: () => CheckoutStrings.acceptTerms),
      act: (bloc) => bloc
        ..add(const CheckoutTermsToggled(true))
        ..add(const CheckoutPlaceOrderPressed()),
      verify: (bloc) {
        expect(bloc.state.termsError, isNull);
        // JavaScript's toISOString(), as the website stamps it.
        expect(placed().personalisation?.termsAcceptedAt, '2026-11-16T03:30:05.120Z');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'unticking again refuses again',
      build: build,
      seed: ready,
      act: (bloc) => bloc
        ..add(const CheckoutTermsToggled(false))
        ..add(const CheckoutPlaceOrderPressed()),
      verify: (bloc) {
        expect(bloc.state.termsError, CheckoutStrings.acceptTerms);
        verifyNever(() => placeOrder(any()));
      },
    );
  });

  group('personalise this gift', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'the sender starts as the signed-in customer',
      build: build,
      act: (bloc) =>
          bloc.add(const CheckoutStarted(cart: cart, config: config, customer: customer)),
      verify: (bloc) {
        expect(bloc.state.senderName, 'Asha Verma');
        expect(bloc.state.senderPhone, '9876543210');
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'occasion, message and sender go with the order; the chosen occasion pressed again clears',
      build: build,
      seed: ready,
      act: (bloc) => bloc
        ..add(const CheckoutOccasionSelected('Birthday'))
        ..add(const CheckoutGiftMessageChanged('Many happy returns!'))
        ..add(const CheckoutSenderChanged(name: 'Ravi'))
        ..add(const CheckoutSenderChanged(phone: '9000000001'))
        ..add(const CheckoutHideSenderToggled(true))
        ..add(const CheckoutPlaceOrderPressed()),
      verify: (_) {
        final gift = placed().personalisation!;
        expect(gift.occasion, 'Birthday');
        expect(gift.message, 'Many happy returns!');
        expect(gift.sender?.name, 'Ravi');
        expect(gift.sender?.phone, '9000000001');
        expect(gift.sender?.hideFromRecipient, isTrue);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'no sender name or phone sends no sender',
      build: build,
      seed: ready,
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      verify: (_) => expect(placed().personalisation?.sender, isNull),
    );
  });

  group('the minimum order', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'under the minimum, Place order refuses with the website\'s message',
      build: build,
      seed: () => ready(minOrderValue: 2000),
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      expect: () => [
        isA<CheckoutState>()
            .having((s) => s.errorMessage, 'message', 'Minimum order value is ₹2,000')
            .having((s) => s.errorField, 'field', 'minOrderValue'),
      ],
      verify: (bloc) {
        expect(bloc.state.belowMinimumOrder, isTrue);
        verifyNever(() => placeOrder(any()));
      },
    );

    test('the shop\'s subtotal decides, not the cart\'s', () {
      // 999 in the cart, but the shop priced it at 2,100 (say, a price rise).
      final priced = ready(minOrderValue: 2000).copyWith(
        quote: () => const Quote(draftId: 'draft-2', totals: pricedHigher),
      );
      expect(priced.belowMinimumOrder, isFalse);
      expect(ready(minOrderValue: 0).belowMinimumOrder, isFalse, reason: '0 is no minimum');
    });

    blocTest<CheckoutBloc, CheckoutState>(
      'the shop\'s minimum is read on start',
      build: build,
      act: (bloc) => bloc.add(CheckoutStarted(cart: cart, config: config.withMinimum(1500))),
      verify: (bloc) => expect(bloc.state.minOrderValue, 1500),
    );
  });

  group('maintenance', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'a closed shop is closed in checkout too, in its own words',
      build: build,
      act: (bloc) => bloc.add(CheckoutStarted(cart: cart, config: config.closed('Back at 6 PM.'))),
      verify: (bloc) => expect(bloc.state.maintenanceNotice, 'Back at 6 PM.'),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a closed shop with no message of its own uses the website\'s default',
      build: build,
      act: (bloc) => bloc.add(CheckoutStarted(cart: cart, config: config.closed(''))),
      verify: (bloc) => expect(bloc.state.maintenanceNotice, StoreConfig.defaultMaintenanceNotice),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'Place order refuses while closed, before anything else',
      build: build,
      seed: () => ready(terms: false, closed: 'Back at 6 PM.'),
      act: (bloc) => bloc.add(const CheckoutPlaceOrderPressed()),
      expect: () => [
        isA<CheckoutState>()
            .having((s) => s.errorMessage, 'message', 'Back at 6 PM.')
            .having((s) => s.termsError, 'not the tick', isNull),
      ],
      verify: (_) => verifyNever(() => placeOrder(any())),
    );
  });

  group('online payment availability', () {
    void answers(Either<ServerFailure, bool?> answer) {
      when(() => checkOnlinePayment(any())).thenAnswer((_) async => answer);
      when(
        () => getCheckoutCatalog(any()),
      ).thenAnswer((_) async => const Left(ServerFailure('catalogue down')));
    }

    blocTest<CheckoutBloc, CheckoutState>(
      'a gateway that says it is not configured hides Pay online and moves to cash',
      setUp: () => answers(const Right(false)),
      build: () => build(withServices: true),
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config)),
      wait: const Duration(milliseconds: 20),
      verify: (bloc) {
        expect(bloc.state.onlineAvailable, isFalse);
        expect(bloc.state.paymentMethod, PaymentMethod.cod);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'no clear answer is not an answer: Pay online stays',
      setUp: () => answers(const Right(null)),
      build: () => build(withServices: true),
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config)),
      wait: const Duration(milliseconds: 20),
      verify: (bloc) {
        expect(bloc.state.onlineAvailable, isTrue);
        expect(bloc.state.paymentMethod, PaymentMethod.online);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a refused check (a 500) keeps Pay online on offer',
      setUp: () => answers(const Left(ServerFailure('boom', null, 500))),
      build: () => build(withServices: true),
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config)),
      wait: const Duration(milliseconds: 20),
      verify: (bloc) => expect(bloc.state.onlineAvailable, isTrue),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a shop with online payment switched off is not asked',
      setUp: () => answers(const Right(true)),
      build: () => build(withServices: true),
      act: (bloc) => bloc.add(CheckoutStarted(cart: cart, config: config.codOnly())),
      wait: const Duration(milliseconds: 20),
      verify: (bloc) {
        verifyNever(() => checkOnlinePayment(any()));
        expect(bloc.state.onlineAvailable, isFalse);
      },
    );
  });

  group('cash on delivery from the live catalogue', () {
    const madeToOrder = CheckoutCatalogEntry(
      slug: 'truffle-cake',
      codAllowed: false,
      cancellationClass: CancellationClass.madeToOrder,
      occasions: ['Birthday', 'anniversary'],
    );

    void catalogue(CheckoutCatalog catalog) {
      when(() => checkOnlinePayment(any())).thenAnswer((_) async => const Right(true));
      when(() => getCheckoutCatalog(any())).thenAnswer((_) async => Right(catalog));
    }

    blocTest<CheckoutBloc, CheckoutState>(
      'the shop switched cash off since the cake was added: no cash, and it says which',
      setUp: () => catalogue(const CheckoutCatalog({'truffle-cake': madeToOrder})),
      build: () => build(withServices: true),
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config)),
      wait: const Duration(milliseconds: 20),
      verify: (bloc) {
        expect(cart.items.single.codAllowed, isTrue, reason: 'the line still says yes');
        expect(bloc.state.codAvailable, isFalse);
        expect(bloc.state.codBlockedBy, ['Truffle Cake']);
        expect(bloc.state.paymentMethod, PaymentMethod.online);
        expect(bloc.state.occasionOptions, ['anniversary', 'Birthday']);
        expect(bloc.state.policyClasses, [CancellationClass.madeToOrder]);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'the coupon lines carry each product'
      's live categories, from the same catalogue',
      setUp: () => catalogue(
        const CheckoutCatalog({
          'truffle-cake': CheckoutCatalogEntry(
            slug: 'truffle-cake',
            categoryIds: ['cakes', 'eggless'],
          ),
        }),
      ),
      build: () => build(withServices: true),
      act: (bloc) {
        bloc.add(const CheckoutStarted(cart: cart, config: config));
        // Before the catalogue answers, no lines: the subtotal alone.
        expect(bloc.state.offerLines, isNull);
      },
      wait: const Duration(milliseconds: 20),
      verify: (bloc) => expect(bloc.state.offerLines, const [
        OfferCartLine(price: 999, quantity: 1, categoryIds: ['cakes', 'eggless']),
      ]),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'no catalogue to read: no coupon lines, never lines in no category',
      setUp: () {
        when(() => checkOnlinePayment(any())).thenAnswer((_) async => const Right(true));
        when(
          () => getCheckoutCatalog(any()),
        ).thenAnswer((_) async => const Left(ServerFailure('down')));
      },
      build: () => build(withServices: true),
      act: (bloc) => bloc.add(const CheckoutStarted(cart: cart, config: config)),
      wait: const Duration(milliseconds: 20),
      verify: (bloc) => expect(bloc.state.offerLines, isNull),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a line that remembers "no cash" is overruled by a shop that now takes it',
      setUp: () => catalogue(
        const CheckoutCatalog({'truffle-cake': CheckoutCatalogEntry(slug: 'truffle-cake')}),
      ),
      build: () => build(withServices: true),
      act: (bloc) => bloc.add(const CheckoutStarted(cart: Cart([noCashLine]), config: config)),
      wait: const Duration(milliseconds: 20),
      verify: (bloc) {
        expect(bloc.state.codAvailable, isTrue);
        expect(bloc.state.codBlockedBy, isEmpty);
      },
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'with no catalogue to read, the line\'s own word stands in',
      setUp: () {
        when(() => checkOnlinePayment(any())).thenAnswer((_) async => const Right(true));
        when(
          () => getCheckoutCatalog(any()),
        ).thenAnswer((_) async => const Left(ServerFailure('down')));
      },
      build: () => build(withServices: true),
      act: (bloc) => bloc.add(const CheckoutStarted(cart: Cart([noCashLine]), config: config)),
      wait: const Duration(milliseconds: 20),
      verify: (bloc) => expect(bloc.state.codAvailable, isFalse),
    );
  });

  group('the "Use PIN" fix', () {
    const mismatch = PinCheckResult(
      status: PinStatus.mismatch,
      message: 'This pin is in PIN 324005, not 324001.',
      field: 'pincode',
      found: PinFound(postalCode: '324005'),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'puts the PIN into the address and checks the pin again against it',
      setUp: () =>
          when(() => checkDeliveryPin(any())).thenAnswer((_) async => const Right(eligiblePin)),
      build: build,
      seed: () => ready().copyWith(pinResult: () => mismatch),
      act: (bloc) => bloc.add(const CheckoutPincodeSuggestionUsed('324005')),
      verify: (bloc) {
        expect(bloc.state.address.pincode, '324005');
        final asked =
            verify(() => checkDeliveryPin(captureAny())).captured.single as PinCheckRequest;
        expect(asked.pincode, '324005');
        expect(asked.location, door);
        expect(bloc.state.pinResult, eligiblePin);
      },
    );
  });

  group('no second quote for the same body', () {
    blocTest<CheckoutBloc, CheckoutState>(
      'asking again with nothing changed does not ask the shop again',
      build: build,
      act: (bloc) async {
        bloc.add(const CheckoutStarted(cart: cart, config: config));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const CheckoutEstimateRequested());
        await Future<void>.delayed(Duration.zero);
        bloc.add(const CheckoutEstimateRequested());
      },
      verify: (_) => verify(() => estimateQuote(any())).called(1),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'a change asks again, and changing it back asks again too',
      build: build,
      act: (bloc) async {
        bloc.add(const CheckoutStarted(cart: cart, config: config));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const CheckoutGiftWrapToggled(true));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const CheckoutGiftWrapToggled(false));
      },
      verify: (_) => verify(() => estimateQuote(any())).called(3),
    );

    blocTest<CheckoutBloc, CheckoutState>(
      'after a failed estimate, retry asks again',
      setUp: () => when(
        () => estimateQuote(any()),
      ).thenAnswer((_) async => const Left(ServerFailure('offline'))),
      build: build,
      act: (bloc) async {
        bloc.add(const CheckoutStarted(cart: cart, config: config));
        await Future<void>.delayed(Duration.zero);
        bloc.add(const CheckoutEstimateRequested());
      },
      verify: (_) => verify(() => estimateQuote(any())).called(2),
    );
  });
}

/// The cart's 999, priced by the shop at 2,100.
const OrderTotals pricedHigher = OrderTotals(
  subtotal: 2100,
  delivery: 0,
  tax: 0,
  discount: 0,
  platformCharge: 0,
  giftWrapFee: 0,
  deliveryTierFee: 0,
  total: 2100,
  itemCount: 1,
);

/// A line added while the product took no cash.
const CartItem noCashLine = CartItem(
  id: 'truffle|1.5 Kg||||',
  productSlug: 'truffle-cake',
  name: 'Truffle Cake',
  image: '',
  unitPrice: 999,
  quantity: 1,
  weight: '1.5 Kg',
  codAllowed: false,
);

extension on StoreConfig {
  StoreConfig withMinimum(double minimum) => _copy(minOrderValue: minimum);

  StoreConfig closed(String message) =>
      _copy(maintenanceEnabled: true, maintenanceMessage: message);

  StoreConfig codOnly() => _copy(online: false);

  StoreConfig _copy({
    double? minOrderValue,
    bool? maintenanceEnabled,
    String? maintenanceMessage,
    bool online = true,
  }) => StoreConfig(
    siteName: siteName,
    tagline: tagline,
    logoUrl: logoUrl,
    currency: currency,
    deliveryFee: deliveryFee,
    freeDeliveryThreshold: freeDeliveryThreshold,
    minOrderValue: minOrderValue ?? this.minOrderValue,
    useZoneBasedDelivery: useZoneBasedDelivery,
    deliveryLeadDays: deliveryLeadDays,
    sameDayCutoff: sameDayCutoff,
    deliveryTimeSlots: deliveryTimeSlots,
    deliveryTiers: deliveryTiers,
    giftWrapEnabled: giftWrapEnabled,
    giftWrapFee: giftWrapFee,
    giftWrapLabel: giftWrapLabel,
    checkoutTerms: checkoutTerms,
    paymentMethods: online
        ? paymentMethods
        : const PaymentMethods(cod: true, upi: false, card: false, razorpay: false),
    maintenanceEnabled: maintenanceEnabled ?? this.maintenanceEnabled,
    maintenanceMessage: maintenanceMessage ?? this.maintenanceMessage,
  );
}
