import 'dart:convert';
import 'dart:io';

import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/core/network/api_envelope.dart';
import 'package:bakery_cms_flutter/core/utils/money_formatter.dart';
import 'package:bakery_cms_flutter/features/offers/data/datasources/offers_remote_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/offers/data/models/coupon_model.dart';
import 'package:bakery_cms_flutter/features/offers/data/repositories/offers_repository_impl.dart';
import 'package:bakery_cms_flutter/features/offers/domain/entities/coupon.dart';
import 'package:bakery_cms_flutter/features/offers/domain/entities/offer_cart_line.dart';
import 'package:bakery_cms_flutter/features/offers/domain/services/coupon_rules.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockClient extends Mock implements ApiClient {}

/// The website's coupon rules (`coupon-offers.ts`, `orders/lib/coupons.ts`).
void main() {
  String money(double amount) => MoneyFormatter.format(amount);
  final now = DateTime.utc(2026, 11, 19, 12);

  const twenty = Coupon(id: 'c1', code: 'BDAY20', label: 'Birthday', percentOff: 20);
  const flat = Coupon(id: 'c2', code: 'SAVE500', label: '', flatOff: 500, minSubtotal: 2000);
  const plants = Coupon(
    id: 'c3',
    code: 'PLANT10',
    label: '',
    percentOff: 10,
    categoryIds: ['cat-plants'],
  );

  group('reading GET /api/coupons', () {
    test('the live answer (captured 2026-11-19) is an empty list: no offers drawn', () {
      final raw = File('test/fixtures/website/api_coupons.json').readAsStringSync();
      expect(ApiEnvelope.unwrap(jsonDecode(raw)), isEmpty);
    });

    test('a StoredCoupon reads whole; an unreadable expiry counts as passed', () {
      final coupon = CouponModel.fromJson({
        'id': 'coupon-bday20',
        'code': ' BDAY20 ',
        'label': '20% OFF',
        'description': 'Birthday special',
        'percentOff': 20,
        'minSubtotal': 999,
        'isActive': true,
        'usageCount': 3,
        'createdAt': '2026-01-01T00:00:00.000Z',
        'expiresAt': '2026-12-31T18:29:59.999Z',
        'categoryIds': ['cat-cakes'],
      }).toEntity()!;
      expect(coupon.code, 'BDAY20');
      expect(coupon.percentOff, 20);
      expect(coupon.minSubtotal, 999);
      expect(coupon.expiresAt, DateTime.utc(2026, 12, 31, 18, 29, 59, 999));
      expect(coupon.categoryIds, ['cat-cakes']);
      expect(CouponRules.isLive(coupon, now), isTrue);

      final garbled = CouponModel.fromJson({
        'id': 'x',
        'code': 'X',
        'label': '',
        'description': '',
        'expiresAt': '31/12/2026',
      }).toEntity()!;
      expect(garbled.expiryUnreadable, isTrue);
      expect(CouponRules.isLive(garbled, now), isFalse);
    });

    test('a coupon with no code is dropped', () {
      expect(
        CouponModel.fromJson({'id': 'x', 'code': ' ', 'label': '', 'description': ''}).toEntity(),
        isNull,
      );
    });

    test('the repository reads once and reuses it for a few minutes', () async {
      final client = _MockClient();
      when(() => client.get('/api/coupons')).thenAnswer(
        (_) async => [
          {'id': 'c1', 'code': 'BDAY20', 'label': '', 'description': '', 'percentOff': 20},
        ],
      );
      var clock = now;
      final repository = OffersRepositoryImpl(
        OffersRemoteDataSourceImpl(client),
        clock: () => clock,
      );
      final results = await Future.wait([repository.liveCoupons(), repository.liveCoupons()]);
      expect(results.first.getOrElse((_) => []).single.code, 'BDAY20');
      verify(() => client.get('/api/coupons')).called(1);
      clock = now.add(const Duration(minutes: 6));
      await repository.liveCoupons();
      verify(() => client.get('/api/coupons')).called(1);
    });
  });

  group('what is said', () {
    test('the discount label (couponDiscountLabel)', () {
      expect(CouponRules.discountLabel(twenty, money), '20% OFF');
      expect(CouponRules.discountLabel(flat, money), '₹500 OFF');
      expect(
        CouponRules.discountLabel(const Coupon(id: 'x', code: 'X', label: ''), money),
        'Special Offer',
      );
    });

    test('the product page lines: free delivery first, then codes, minimums said', () {
      expect(
        CouponRules.productPageLines(
          coupons: const [
            twenty,
            flat,
            Coupon(id: 'off', code: 'OFF', label: '', isActive: false),
          ],
          freeDeliveryThreshold: 999,
          money: money,
          now: now,
        ),
        [
          'Free delivery on orders over ₹999',
          'Use code BDAY20 — 20% OFF',
          'Use code SAVE500 — ₹500 OFF on orders over ₹2,000',
        ],
      );
    });

    test('nothing to say: no lines, so no block', () {
      expect(
        CouponRules.productPageLines(
          coupons: const [],
          freeDeliveryThreshold: 0,
          money: money,
          now: now,
        ),
        isEmpty,
      );
    });

    test('an expired coupon is not offered', () {
      final expired = Coupon(
        id: 'e',
        code: 'OLD',
        label: '',
        percentOff: 5,
        expiresAt: now.subtract(const Duration(days: 1)),
      );
      expect(CouponRules.isLive(expired, now), isFalse);
    });
  });

  group('offers for a basket (offersForCart + evaluateCoupon)', () {
    test('what each saves now, or what it still needs; the applied one left out', () {
      final offers = CouponRules.forCart(
        const [twenty, flat],
        subtotal: 1499,
        money: money,
        now: now,
      );
      expect(offers.map((o) => o.code), ['BDAY20', 'SAVE500']);
      // 20% of ₹1,499, in whole rupees.
      expect(offers.first.check?.saving, 300);
      expect(offers.first.shortfall, 0);
      expect(offers.last.shortfall, 501);
      expect(offers.last.check, isNull);

      expect(
        CouponRules.forCart(
          const [twenty, flat],
          subtotal: 1499,
          appliedCode: 'bday20',
          money: money,
          now: now,
        ).map((o) => o.code),
        ['SAVE500'],
      );
    });

    test('a flat discount never exceeds the basket', () {
      const big = Coupon(id: 'b', code: 'BIG', label: '', flatOff: 5000);
      expect(CouponRules.check(big, subtotal: 1200, money: money, now: now).saving, 1200);
    });

    test('a category coupon is measured against only its categories', () {
      const lines = [
        OfferCartLine(price: 300, quantity: 1, categoryIds: ['cat-plants']),
        OfferCartLine(price: 5000, quantity: 1, categoryIds: ['cat-cakes']),
      ];
      expect(
        CouponRules.check(plants, subtotal: 5300, lines: lines, money: money, now: now).saving,
        30,
      );
      // Without the lines it cannot be judged, as on the website.
      expect(
        CouponRules.check(plants, subtotal: 5300, money: money, now: now).message,
        'This code applies to selected items only',
      );
    });

    test('a minimum not met is refused in the website\'s words', () {
      expect(
        CouponRules.check(flat, subtotal: 1000, money: money, now: now).message,
        'Minimum order ₹2,000 required',
      );
    });

    test('cents are kept for a currency that has them', () {
      expect(CouponRules.roundToCurrency(1.256, 'USD'), 1.26);
      expect(CouponRules.roundToCurrency(299.8, 'INR'), 300);
    });
  });
}
