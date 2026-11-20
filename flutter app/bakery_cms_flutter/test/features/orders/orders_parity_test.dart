import 'package:bakery_cms_flutter/core/constants/api_endpoints.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/orders/data/datasources/orders_remote_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/orders/data/models/order_model.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/cancellation_class.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/refund_state.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/cancel_order.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/email_invoice.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/email_invoice_params.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/get_order_details.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/order_detail_cubit.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/order_detail_state.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/widgets/order_gift_card.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/widgets/order_payment_card.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/widgets/order_policy_card.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/widgets/order_status_label.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart' hide Order;
import 'package:mocktail/mocktail.dart';

import 'order_fixtures.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _MockGetOrderDetails extends Mock implements GetOrderDetails {}

class _MockCancelOrder extends Mock implements CancelOrder {}

class _MockEmailInvoice extends Mock implements EmailInvoice {}

/// The order screens say what the website's order pages say: the payment by
/// its status (`paymentText`), the refund by the gateway's own refunds
/// (`refundState`), the policy the order was placed under, and the gift.
void main() {
  Order order({
    String status = 'confirmed',
    String method = 'razorpay',
    String paymentStatus = 'paid',
    Map<String, dynamic>? refundRecord,
    Map<String, dynamic>? extra,
  }) => OrderModel.fromJson({
    ...orderJson(status: status),
    'paymentMethod': method,
    'paymentStatus': paymentStatus,
    'refundRecord': ?refundRecord,
    ...?extra,
  }).toEntity();

  group('the payment line (paymentText)', () {
    test('an online payment still pending never reads "Paid online"', () {
      expect(order(paymentStatus: 'pending').paymentLabel, 'Payment pending');
    });

    test('a failed online payment says so', () {
      expect(order(paymentStatus: 'failed').paymentLabel, 'Payment failed');
    });

    test('cash on delivery, and once delivered, paid on delivery', () {
      expect(order(method: 'cod', paymentStatus: 'cod').paymentLabel, 'Cash on delivery');
      expect(
        order(method: 'cod', paymentStatus: 'cod', status: 'delivered').paymentLabel,
        'Paid on delivery',
      );
    });

    test('a refund the bank bounced is not "in progress"', () {
      final bounced = order(
        status: 'cancelled',
        refundRecord: {
          'status': 'processing',
          'amount': 2934,
          'gatewayRefunds': [
            {'status': 'failed', 'amount': 2934},
          ],
        },
      );
      expect(bounced.refund?.state, RefundState.failed);
      expect(bounced.paymentLabel, 'Paid online · refund failed');
    });

    test('a bounced refund also leaves the record "rejected": still failed, not declined', () {
      final bounced = order(
        status: 'cancelled',
        refundRecord: {
          'status': 'rejected',
          'amount': 2934,
          'gatewayRefunds': [
            {'status': 'failed', 'amount': 2934},
          ],
        },
      );
      expect(bounced.refund?.state, RefundState.failed);
      expect(bounced.paymentLabel, 'Paid online · refund failed');
    });

    test('a gateway refund still pending is processing', () {
      final moving = order(
        status: 'cancelled',
        refundRecord: {
          'status': 'rejected',
          'amount': 34,
          'gatewayRefunds': [
            {'status': 'pending', 'amount': 34},
          ],
        },
      );
      expect(moving.refund?.state, RefundState.processing);
      expect(moving.paymentLabel, 'Refund in progress');
    });

    test('refundState, line for line', () {
      RefundState? stateOf(Map<String, dynamic> record) =>
          order(status: 'cancelled', refundRecord: record).refund?.state;
      expect(stateOf({'status': 'completed', 'amount': 1}), RefundState.processed);
      expect(stateOf({'status': 'requested', 'amount': 1}), RefundState.pending);
      expect(stateOf({'status': 'processing', 'amount': 1}), RefundState.processing);
      expect(stateOf({'status': 'rejected', 'amount': 1}), RefundState.notApplicable);
      expect(order().refund, isNull);
    });
  });

  group('the order detail cards', () {
    Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    );

    testWidgets('a pending online payment reads Online payment / Payment pending', (tester) async {
      await pump(tester, OrderPaymentCard(order: order(paymentStatus: 'pending')));
      expect(find.text('Online payment'), findsOneWidget);
      expect(find.text('Payment pending'), findsOneWidget);
      expect(find.text('Paid online'), findsNothing);
    });

    testWidgets('the policy it was placed under, when the terms were agreed, and the refund', (
      tester,
    ) async {
      final placed = order(
        status: 'cancelled',
        refundRecord: {
          'status': 'processing',
          'amount': 2934,
          'gatewayRefunds': [
            {'status': 'failed', 'amount': 2934},
          ],
        },
        extra: {
          'cancellationPolicy': {
            'version': 'p1',
            'text': '',
            'policyClass': 'non_cancellable',
            'itemClasses': <Object>[],
            'acceptedAt': '2026-11-16T03:30:05.120Z',
          },
        },
      );
      expect(placed.policyClass, CancellationClass.nonCancellable);
      await pump(tester, OrderPolicyCard(order: placed));
      expect(find.text('Cannot be cancelled once ordered.'), findsOneWidget);
      expect(find.textContaining('Agreed at checkout on'), findsOneWidget);
      expect(find.text('Failed'), findsOneWidget);
      expect(find.text('Processing'), findsNothing);
    });

    testWidgets('no refund row on an order with no refund', (tester) async {
      await pump(tester, OrderPolicyCard(order: order()));
      expect(find.text('Refund'), findsNothing);
      expect(find.text('Can be cancelled until we start preparing it.'), findsOneWidget);
    });

    testWidgets('the occasion and the gift message, read from personalisation', (tester) async {
      final gifted = order(
        extra: {
          'personalisation': {
            'occasion': 'Birthday',
            'message': 'Many happy returns!',
            'sender': {'name': 'Ravi', 'phone': '9000000001', 'hideFromRecipient': true},
            'termsAcceptedAt': '2026-11-16T03:30:05.120Z',
          },
        },
      );
      expect(gifted.gift?.senderName, 'Ravi');
      await pump(tester, OrderGiftCard(gift: gifted.gift!));
      expect(find.text('Occasion: Birthday'), findsOneWidget);
      expect(find.text('“Many happy returns!”'), findsOneWidget);
    });

    test('an order with no personalisation has no gift', () {
      expect(order().gift, isNull);
      expect(order(extra: {'personalisation': <String, Object>{}}).gift, isNull);
    });
  });

  group('Email invoice', () {
    test('the path is the website\'s: the owner\'s email as a query, no body', () {
      expect(
        ApiEndpoints.orderInvoiceEmail('BK-20261116-4821', email: ' asha+cakes@example.com '),
        '/api/orders/by-number/BK-20261116-4821/email-invoice?email=asha%2Bcakes%40example.com',
      );
    });

    test('the data source POSTs that path with no body and reads where it went', () async {
      final client = _MockApiClient();
      when(
        () => client.post(any(), body: any(named: 'body')),
      ).thenAnswer((_) async => {'to': 'asha@example.com'});

      final to = await OrdersRemoteDataSourceImpl(
        client,
      ).emailInvoice('BK-1', email: 'asha@example.com');

      expect(to, 'asha@example.com');
      verify(
        () => client.post('/api/orders/by-number/BK-1/email-invoice?email=asha%40example.com'),
      ).called(1);
    });

    late _MockGetOrderDetails getDetails;
    late _MockCancelOrder cancelOrder;
    late _MockEmailInvoice emailInvoice;
    final details = OrderModel.fromJson(orderJson()).toDetails();

    setUpAll(() => registerFallbackValue(const EmailInvoiceParams(orderNumber: '', email: '')));

    setUp(() {
      getDetails = _MockGetOrderDetails();
      cancelOrder = _MockCancelOrder();
      emailInvoice = _MockEmailInvoice();
    });

    OrderDetailCubit build() => OrderDetailCubit(
      getOrderDetails: getDetails,
      cancelOrder: cancelOrder,
      emailInvoice: emailInvoice,
    );

    blocTest<OrderDetailCubit, OrderDetailState>(
      'sends for this order, with the order\'s own email as the lookup',
      setUp: () =>
          when(() => emailInvoice(any())).thenAnswer((_) async => const Right('asha@x.in')),
      build: build,
      seed: () => OrderDetailState(status: ViewStatus.success, details: details),
      act: (cubit) => cubit.emailInvoice(),
      expect: () => [
        OrderDetailState(
          status: ViewStatus.success,
          details: details,
          invoiceStatus: ViewStatus.loading,
        ),
        OrderDetailState(
          status: ViewStatus.success,
          details: details,
          invoiceStatus: ViewStatus.success,
          invoiceSentTo: 'asha@x.in',
        ),
      ],
      verify: (_) => verify(
        () => emailInvoice(
          EmailInvoiceParams(
            orderNumber: details.order.orderNumber,
            email: details.order.address.email,
          ),
        ),
      ).called(1),
    );

    blocTest<OrderDetailCubit, OrderDetailState>(
      'a refusal keeps the order and says why',
      setUp: () => when(
        () => emailInvoice(any()),
      ).thenAnswer((_) async => const Left(ServerFailure('Mail is not set up'))),
      build: build,
      seed: () => OrderDetailState(status: ViewStatus.success, details: details),
      act: (cubit) => cubit.emailInvoice(),
      skip: 1,
      expect: () => [
        OrderDetailState(
          status: ViewStatus.success,
          details: details,
          invoiceStatus: ViewStatus.failure,
          invoiceError: 'Mail is not set up',
        ),
      ],
    );

    blocTest<OrderDetailCubit, OrderDetailState>(
      'a second press while one is on its way sends nothing more',
      setUp: () => when(() => emailInvoice(any())).thenAnswer((_) async => const Right('a@b.in')),
      build: build,
      seed: () => OrderDetailState(
        status: ViewStatus.success,
        details: details,
        invoiceStatus: ViewStatus.loading,
      ),
      act: (cubit) => cubit.emailInvoice(),
      expect: () => <OrderDetailState>[],
      verify: (_) => verifyNever(() => emailInvoice(any())),
    );
  });
}
