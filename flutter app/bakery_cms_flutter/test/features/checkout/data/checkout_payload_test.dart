import 'package:bakery_cms_flutter/features/checkout/data/models/order_request_model.dart';
import 'package:bakery_cms_flutter/features/checkout/data/models/quote_model.dart';
import 'package:bakery_cms_flutter/features/checkout/data/models/quote_request_model.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/order_submission.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote_request.dart';
import 'package:flutter_test/flutter_test.dart';

import '../checkout_fixtures.dart';

/// The shop's zod schemas take a missing optional field but refuse `null`,
/// so every absent value must be left out of the body.
void main() {
  test('an estimate sends the area, no address, and no nulls', () {
    final json = QuoteRequestModel.fromEntity(
      QuoteRequest(items: cart.items, deliveryTierId: 'standard', pincode: '324001', city: 'Kota'),
    ).toJson();

    expect(json['deliveryAddress'], {'city': 'Kota', 'pincode': '324001'});
    expect(json.containsKey('address'), isFalse);
    expect(json.containsKey('couponCode'), isFalse);
    expect(json.containsKey('giftWrap'), isFalse);
    expect(json['items'], [
      {'productSlug': 'truffle-cake', 'quantity': 1, 'weight': '1.5 Kg'},
    ]);
  });

  test('a final quote sends the full address with its pin, and the slot', () {
    final json = QuoteRequestModel.fromEntity(
      QuoteRequest(items: cart.items, address: address, slot: slot, giftWrap: true),
    ).toJson();

    expect(json.containsKey('deliveryAddress'), isFalse);
    final sent = json['address'] as Map<String, dynamic>;
    expect(sent['location'], {'lat': door.lat, 'lng': door.lng});
    expect(sent['addressLabel'], 'Home');
    expect(sent.containsKey('landmark'), isFalse);
    expect(json['deliverySlot'], {
      'date': '2026-11-16',
      'timeSlot': '12:00 PM – 2:00 PM',
      'tierId': 'standard',
      'tierLabel': 'Standard Delivery',
    });
    expect(json['giftWrap'], isTrue);
  });

  test('the order body names its draft, method and reference', () {
    final json = OrderRequestModel.fromEntity(
      OrderSubmission(
        id: 'uuid-1',
        draftId: 'draft-1',
        items: cart.items,
        totals: totals,
        address: address,
        slot: slot,
        paymentMethod: PaymentMethod.online,
        paymentReference: 'pay_123',
      ),
    ).toJson();

    expect(json['draftId'], 'draft-1');
    expect(json['paymentMethod'], 'razorpay');
    expect(json['paymentReference'], 'pay_123');
    expect((json['totals'] as Map)['total'], 1048.95);
    expect((json['items'] as List).single, containsPair('price', 999.0));
    expect(json.containsKey('orderNotes'), isFalse);
  });

  test('a quote answer is read, coupon included', () {
    final parsed = QuoteModel.fromJson({
      'draftId': 'draft-9',
      'items': <Object>[],
      'totals': {'subtotal': 999, 'total': 950, 'itemCount': 1, 'discount': 49},
      'coupon': {'code': 'SWEET', 'label': 'Sweet deal', 'discountAmount': 49},
    }).toEntity();

    expect(parsed.draftId, 'draft-9');
    expect(parsed.totals.total, 950);
    expect(parsed.totals.delivery, 0);
    expect(parsed.coupon?.code, 'SWEET');
    expect(parsed.rejectedCoupon, isNull);
  });
}
