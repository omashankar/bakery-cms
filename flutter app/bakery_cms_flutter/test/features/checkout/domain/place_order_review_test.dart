import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/order_submission.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_result.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/paid_but_unconfirmed_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/price_change_reason.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/price_changed_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/repositories/checkout_repository.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/repositories/payment_gateway.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order_params.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order_totals.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout_fixtures.dart';

class _MockRepository extends Mock implements CheckoutRepository {}

class _MockGateway extends Mock implements PaymentGateway {}

/// The review's findings on "Place order": a price the customer never saw,
/// server errors after payment, and refusals after payment.
void main() {
  late _MockRepository repository;
  late _MockGateway gateway;
  late PlaceOrder placeOrder;

  setUpAll(() {
    registerFallbackValue(QuoteRequest(items: cart.items));
    registerFallbackValue(
      OrderSubmission(
        id: '',
        draftId: '',
        items: const [],
        totals: totals,
        address: address,
        slot: slot,
        paymentMethod: PaymentMethod.cod,
      ),
    );
    registerFallbackValue(
      const PaymentRequest(
        order: razorpayOrder,
        shopName: '',
        description: '',
        name: '',
        email: '',
        phone: '',
      ),
    );
  });

  setUp(() {
    repository = _MockRepository();
    gateway = _MockGateway();
    placeOrder = PlaceOrder(repository: repository, gateway: gateway, retryDelay: Duration.zero);
    when(() => gateway.isSupported).thenReturn(true);
    when(() => repository.quote(any())).thenAnswer((_) async => const Right(quote));
  });

  void stubPaid() {
    when(() => repository.createOnlinePayment(any()))
        .thenAnswer((_) async => const Right(razorpayOrder));
    when(() => gateway.pay(any()))
        .thenAnswer((_) async => const Right(PaymentResult(paymentId: 'pay_123')));
  }

  void expectNothingTaken() {
    verifyNever(() => repository.createOnlinePayment(any()));
    verifyNever(() => gateway.pay(any()));
    verifyNever(() => repository.placeOrder(any()));
  }

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

    test('a final total above the one shown stops before any payment', () async {
      when(() => repository.quote(any()))
          .thenAnswer((_) async => const Right(Quote(draftId: 'draft-2', totals: dearer)));

      final result = await placeOrder(paramsFor(PaymentMethod.online));

      final failure = result.getLeft().toNullable()! as PriceChangedFailure;
      expect(failure, isA<PriceChangedFailure>());
      expect(failure.reason, PriceChangeReason.totalChanged);
      expect(failure.quote.totals.total, 1197.95);
      expectNothingTaken();
    });

    test('a coupon the shop now refuses stops the order', () async {
      when(() => repository.quote(any())).thenAnswer(
        (_) async => const Right(Quote(draftId: 'draft-2', totals: totals, rejectedCoupon: 'BDAY20')),
      );
      final params = PlaceOrderParams(
        orderId: 'uuid-1',
        expectedTotal: totals.total,
        items: cart.items,
        address: address,
        slot: slot,
        paymentMethod: PaymentMethod.cod,
        shopName: 'Shop',
        couponCode: 'BDAY20',
      );

      final result = await placeOrder(params);

      expect((result.getLeft().toNullable()! as PriceChangedFailure).reason,
          PriceChangeReason.couponRejected);
      expectNothingTaken();
    });

    test('no total shown at all is not a confirmed price', () async {
      final params = PlaceOrderParams(
        orderId: 'uuid-1',
        items: cart.items,
        address: address,
        slot: slot,
        paymentMethod: PaymentMethod.cod,
        shopName: 'Shop',
      );

      final result = await placeOrder(params);

      expect((result.getLeft().toNullable()! as PriceChangedFailure).reason,
          PriceChangeReason.notShown);
      expectNothingTaken();
    });

    test('the same total within a paisa goes ahead', () async {
      when(() => repository.placeOrder(any())).thenAnswer((_) async => const Right(confirmation));
      final params = PlaceOrderParams(
        orderId: 'uuid-1',
        expectedTotal: totals.total + 0.000001,
        items: cart.items,
        address: address,
        slot: slot,
        paymentMethod: PaymentMethod.cod,
        shopName: 'Shop',
      );

      expect((await placeOrder(params)).isRight(), isTrue);
    });
  });

  group('server errors', () {
    test('a 5xx on a cash order is retried with the same id', () async {
      var calls = 0;
      when(() => repository.placeOrder(any())).thenAnswer((_) async {
        calls++;
        return calls == 1 ? const Left(ServerFailure(null, null, 502)) : const Right(confirmation);
      });

      final result = await placeOrder(paramsFor(PaymentMethod.cod));

      expect(result.isRight(), isTrue);
      expect(calls, 2);
      final ids = verify(() => repository.placeOrder(captureAny()))
          .captured
          .cast<OrderSubmission>()
          .map((s) => s.id)
          .toSet();
      expect(ids, {'uuid-1'});
    });

    test('after payment a 5xx is retried, never paid again, then reported as paid', () async {
      stubPaid();
      when(() => repository.placeOrder(any()))
          .thenAnswer((_) async => const Left(ServerFailure(null, null, 500)));

      final result = await placeOrder(paramsFor(PaymentMethod.online));

      expect(result, Left<Object, Never>(PaidButUnconfirmedFailure(paymentId: 'pay_123')));
      verify(() => gateway.pay(any())).called(1);
      final sent = verify(() => repository.placeOrder(captureAny()))
          .captured
          .cast<OrderSubmission>()
          .map((s) => (s.id, s.draftId, s.paymentReference))
          .toList();
      expect(sent, hasLength(3));
      expect(sent.toSet(), {('uuid-1', 'draft-1', 'pay_123')}, reason: 'the same submission every time');
    });

    test('a refusal after payment says so, with the payment id, and is not retried', () async {
      stubPaid();
      when(() => repository.placeOrder(any())).thenAnswer(
        (_) async => const Left(ServerFailure('This cart needs to be priced again.', null, 409)),
      );

      final result = await placeOrder(paramsFor(PaymentMethod.online));

      final failure = result.getLeft().toNullable()! as PaidButUnconfirmedFailure;
      expect(failure.refused, isTrue);
      expect(failure.paymentId, 'pay_123');
      expect(failure.message, contains('pay_123'));
      verify(() => repository.placeOrder(any())).called(1);
    });

    test('a dropped connection after payment is "not confirmed yet", not refused', () async {
      stubPaid();
      when(() => repository.placeOrder(any())).thenAnswer((_) async => const Left(NetworkFailure()));

      final failure =
          (await placeOrder(paramsFor(PaymentMethod.online))).getLeft().toNullable()!
              as PaidButUnconfirmedFailure;

      expect(failure.refused, isFalse);
    });
  });
}
