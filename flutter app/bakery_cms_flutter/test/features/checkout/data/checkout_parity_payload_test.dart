import 'dart:convert';
import 'dart:io';

import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/checkout/data/models/order_request_model.dart';
import 'package:bakery_cms_flutter/features/checkout/data/models/personalisation_model.dart';
import 'package:bakery_cms_flutter/features/checkout/data/models/pin_check_model.dart';
import 'package:bakery_cms_flutter/features/checkout/data/models/quote_request_model.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/order_personalisation.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/order_sender.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/order_submission.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote_request.dart';
import 'package:flutter_test/flutter_test.dart';

import '../checkout_fixtures.dart';

/// The app's bodies against the website's, key for key.
///
/// The fixtures in test/fixtures were written from the website's own code:
/// `requestCartQuote` (features/checkout/lib/quote-api.ts) for the quote,
/// `placeOrder` + `placeOrderRequest` (features/orders/lib/orders.ts,
/// orders-api.ts) for the order, `collectPersonalisation` (checkout-page.tsx)
/// for `personalisation`, and the server's `quoteSchema` /
/// `placeOrderSchema`, which strip any key they do not name. A key the app
/// stops sending, renames or nests differently fails here.
void main() {
  Map<String, dynamic> fixture(String name) =>
      jsonDecode(File('test/fixtures/$name').readAsStringSync()) as Map<String, dynamic>;

  /// Through JSON and back, as Dio sends it: doubles, nesting and all.
  Map<String, dynamic> wire(Map<String, dynamic> body) =>
      jsonDecode(jsonEncode(body)) as Map<String, dynamic>;

  const line = CartItem(
    id: 'truffle|1.5 Kg||Happy Birthday Riya|egg=eggless|',
    productSlug: 'truffle-cake',
    name: 'Truffle Cake',
    image: '',
    unitPrice: 999,
    quantity: 1,
    weight: '1.5 Kg',
    weightLabel: 'Weight',
    message: 'Happy Birthday Riya',
    deliveryDate: '2026-11-17',
    deliveryTime: '6:00 PM – 8:00 PM',
    variantSelections: {'egg': 'eggless'},
    variantSummary: ['Egg: Eggless'],
    // A snapshot the shop never reads from the body.
    codAllowed: false,
  );

  final fullAddress = address.copyWith(
    altPhone: ' 9123456780 ',
    addressLine2: 'Talwandi',
    landmark: 'Opposite the water tank',
    country: 'India',
  );

  const personalisation = OrderPersonalisation(
    occasion: 'Birthday',
    message: 'Many happy returns!',
    sender: OrderSender(name: 'Ravi', phone: '9000000001', hideFromRecipient: true),
    termsAcceptedAt: '2026-11-16T03:30:00.000Z',
  );

  test('the final quote is the body the website posts to /api/checkout/quote', () {
    final body = QuoteRequestModel.fromEntity(
      QuoteRequest(
        items: const [line],
        couponCode: 'SWEET',
        giftWrap: true,
        deliveryTierId: 'standard',
        address: fullAddress,
        slot: slot,
        orderNotes: 'Ring twice',
        personalisation: personalisation,
      ),
    ).toJson();

    expect(wire(body), fixture('checkout_quote_body.json'));
  });

  test('the order is the body the website posts to /api/orders', () {
    final body = OrderRequestModel.fromEntity(
      OrderSubmission(
        id: 'uuid-1',
        draftId: 'draft-1',
        items: const [line],
        totals: totals,
        address: fullAddress,
        slot: slot,
        paymentMethod: PaymentMethod.online,
        paymentReference: 'pay_123',
        orderNotes: 'Ring twice',
        personalisation: personalisation,
      ),
    ).toJson();

    expect(wire(body), fixture('checkout_order_body.json'));
  });

  group('personalisation, as collectPersonalisation() builds it', () {
    Map<String, dynamic>? sent(OrderPersonalisation value) =>
        PersonalisationModel.fromEntity(value)?.toJson();

    test('nothing chosen sends no personalisation at all', () {
      expect(PersonalisationModel.fromEntity(const OrderPersonalisation()), isNull);
      expect(
        PersonalisationModel.fromEntity(
          const OrderPersonalisation(
            occasion: ' ',
            message: '',
            sender: OrderSender(name: ' ', phone: ''),
          ),
        ),
        isNull,
      );
      final json = QuoteRequestModel.fromEntity(
        QuoteRequest(items: cart.items, personalisation: const OrderPersonalisation()),
      ).toJson();
      expect(json.containsKey('personalisation'), isFalse);
    });

    test('the tick alone is still sent: it is the consent the order records', () {
      expect(sent(const OrderPersonalisation(termsAcceptedAt: '2026-11-16T03:30:00.000Z')), {
        'termsAcceptedAt': '2026-11-16T03:30:00.000Z',
      });
    });

    test('a sender with only a name keeps the phone as a blank, and no hide flag', () {
      expect(
        sent(
          const OrderPersonalisation(
            sender: OrderSender(name: 'Ravi', phone: ''),
          ),
        ),
        {
          'sender': {'name': 'Ravi', 'phone': ''},
        },
      );
    });
  });

  test('a blank second number and country are left out, as the schema allows', () {
    final json = QuoteRequestModel.fromEntity(
      QuoteRequest(items: cart.items, address: address, slot: slot),
    ).toJson();
    final sent = json['address'] as Map<String, dynamic>;
    expect(sent.containsKey('altPhone'), isFalse);
    expect(sent.containsKey('country'), isFalse);
  });

  test('the address carries altPhone and country, which the schema names', () {
    const filled = CheckoutAddress(altPhone: '91234', country: 'India');
    expect(filled.altPhone, '91234');
    expect(filled.copyWith(country: 'Nepal').country, 'Nepal');
  });

  group('the delivery-pin answer', () {
    test('an eligible answer reads every field the website shows', () {
      final pin = PinCheckModel.fromJson({
        'required': true,
        'status': 'eligible',
        'zoneId': 'z1',
        'charge': 99,
        'minDeliveryDays': 1,
        'freeDeliveryThreshold': 999,
        'region': {
          'state': 'Rajasthan',
          'districts': ['Kota'],
        },
        'postalCode': '324005',
        'pincodeSure': false,
        'otherPincodes': ['324007'],
        'city': 'Kota',
        'state': 'Rajasthan',
        'formattedAddress': 'Talwandi, Kota',
        'placeName': 'Talwandi',
        'cityNote': 'Kota city delivery',
      }).toEntity();

      expect(pin.status, PinStatus.eligible);
      expect(pin.region?.districts, ['Kota']);
      expect(pin.freeDeliveryThreshold, 999);
      expect(pin.cityNote, 'Kota city delivery');
      expect(pin.pincodeChoices('324001'), ['324005', '324007']);
      expect(pin.pincodeChoices('324005'), ['324007'], reason: 'never the PIN already typed');
    });

    test('a PIN mismatch names the PIN at the pin, for the Use PIN button', () {
      final pin = PinCheckModel.fromJson({
        'required': true,
        'status': 'mismatch',
        'message': 'This pin is in PIN 324005, not 324001.',
        'field': 'pincode',
        'found': {
          'postalCode': '324005',
          'city': 'Kota',
          'state': 'Rajasthan',
          'formattedAddress': 'Talwandi, Kota',
        },
      }).toEntity();

      expect(pin.status, PinStatus.mismatch);
      expect(pin.found?.formattedAddress, 'Talwandi, Kota');
      expect(pin.suggestedPincode('324001'), '324005');
      expect(pin.suggestedPincode('324005'), isNull, reason: 'already typed');
    });

    test('an outside answer carries the distance to the nearest area', () {
      final pin = PinCheckModel.fromJson({
        'status': 'outside',
        'message': 'We do not deliver here yet.',
        'field': 'location',
        'kmToArea': 4.6,
      }).toEntity();

      expect(pin.status, PinStatus.outside);
      expect(pin.kmToArea, 4.6);
      expect(pin.suggestedPincode('324001'), isNull, reason: 'only a PIN refusal suggests one');
    });
  });
}
