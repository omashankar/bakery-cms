import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/order_submission.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_result.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote_request.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/paid_but_unconfirmed_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/payment_cancelled_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/failures/payment_unavailable_failure.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/repositories/checkout_repository.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/repositories/payment_gateway.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout_fixtures.dart';

class _MockRepository extends Mock implements CheckoutRepository {}

class _MockGateway extends Mock implements PaymentGateway {}

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
    placeOrder = PlaceOrder(
      repository: repository,
      gateway: gateway,
      retryDelay: Duration.zero,
    );
    when(() => gateway.isSupported).thenReturn(true);
    when(() => repository.quote(any())).thenAnswer((_) async => const Right(quote));
  });

  OrderSubmission submitted() =>
      verify(() => repository.placeOrder(captureAny())).captured.last as OrderSubmission;

  test('cash on delivery: final quote with the full address, then the order', () async {
    when(() => repository.placeOrder(any())).thenAnswer((_) async => const Right(confirmation));

    final result = await placeOrder(paramsFor(PaymentMethod.cod));

    expect(result, const Right<Never, Object>(confirmation));
    final request = verify(() => repository.quote(captureAny())).captured.single as QuoteRequest;
    expect(request.address, address);
    expect(request.slot, slot);
    expect(request.deliveryTierId, 'standard');
    final order = submitted();
    expect(order.draftId, 'draft-1');
    expect(order.id, 'uuid-1');
    expect(order.paymentMethod, PaymentMethod.cod);
    expect(order.paymentReference, isNull);
    verifyNever(() => repository.createOnlinePayment(any()));
  });

  test('online: opens a Razorpay order on the draft, pays, places with the reference', () async {
    when(() => repository.createOnlinePayment('draft-1'))
        .thenAnswer((_) async => const Right(razorpayOrder));
    when(() => gateway.pay(any()))
        .thenAnswer((_) async => const Right(PaymentResult(paymentId: 'pay_123')));
    when(() => repository.placeOrder(any())).thenAnswer((_) async => const Right(confirmation));

    final result = await placeOrder(paramsFor(PaymentMethod.online));

    expect(result.isRight(), isTrue);
    final payment = verify(() => gateway.pay(captureAny())).captured.single as PaymentRequest;
    expect(payment.order, razorpayOrder);
    expect(payment.email, address.email);
    final order = submitted();
    expect(order.paymentMethod, PaymentMethod.online);
    expect(order.paymentReference, 'pay_123');
  });

  test('online where the gateway has no SDK is refused before anything is sent', () async {
    when(() => gateway.isSupported).thenReturn(false);

    final result = await placeOrder(paramsFor(PaymentMethod.online));

    expect(result, const Left<Object, Never>(PaymentUnavailableFailure()));
    verifyNever(() => repository.quote(any()));
  });

  test('a cancelled payment places no order', () async {
    when(() => repository.createOnlinePayment(any()))
        .thenAnswer((_) async => const Right(razorpayOrder));
    when(() => gateway.pay(any())).thenAnswer((_) async => const Left(PaymentCancelledFailure()));

    final result = await placeOrder(paramsFor(PaymentMethod.online));

    expect(result, const Left<Object, Never>(PaymentCancelledFailure()));
    verifyNever(() => repository.placeOrder(any()));
  });

  test('a refused quote stops the flow and keeps the shop\'s field', () async {
    const refusal = ServerFailure('That delivery window has already passed today.', 'deliverySlot.timeSlot');
    when(() => repository.quote(any())).thenAnswer((_) async => const Left(refusal));

    final result = await placeOrder(paramsFor(PaymentMethod.cod));

    expect(result, const Left<Object, Never>(refusal));
    verifyNever(() => repository.placeOrder(any()));
  });

  test('a dropped connection is retried with the same order id', () async {
    var calls = 0;
    when(() => repository.placeOrder(any())).thenAnswer((_) async {
      calls++;
      return calls == 1 ? const Left(NetworkFailure()) : const Right(confirmation);
    });

    final result = await placeOrder(paramsFor(PaymentMethod.cod));

    expect(result.isRight(), isTrue);
    final ids = verify(() => repository.placeOrder(captureAny()))
        .captured
        .cast<OrderSubmission>()
        .map((order) => order.id)
        .toSet();
    expect(calls, 2);
    expect(ids, {'uuid-1'});
  });

  test('a refusal is not retried', () async {
    when(() => repository.placeOrder(any()))
        .thenAnswer((_) async => const Left(ServerFailure('Out of stock', 'items')));

    await placeOrder(paramsFor(PaymentMethod.cod));

    verify(() => repository.placeOrder(any())).called(1);
  });

  test('paid but never confirmed tells the customer not to pay again', () async {
    when(() => repository.createOnlinePayment(any()))
        .thenAnswer((_) async => const Right(razorpayOrder));
    when(() => gateway.pay(any()))
        .thenAnswer((_) async => const Right(PaymentResult(paymentId: 'pay_123')));
    when(() => repository.placeOrder(any())).thenAnswer((_) async => const Left(NetworkFailure()));

    final result = await placeOrder(paramsFor(PaymentMethod.online));

    expect(result, Left<Object, Never>(PaidButUnconfirmedFailure(paymentId: 'pay_123')));
    verify(() => repository.placeOrder(any())).called(3);
  });
}
