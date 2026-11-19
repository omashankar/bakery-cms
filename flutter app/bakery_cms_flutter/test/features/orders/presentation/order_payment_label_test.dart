import 'package:bakery_cms_flutter/features/orders/data/models/order_model.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/widgets/order_payment_card.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/widgets/order_status_label.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../order_fixtures.dart';

/// A cancelled online payment must not read "Paid": the customer has to see
/// whether their money is coming back. Same rule as the website's order page.
void main() {
  Order paidOrder({String status = 'confirmed', Map<String, dynamic>? refundRecord}) =>
      OrderModel.fromJson({
        ...orderJson(status: status),
        'paymentMethod': 'razorpay',
        'paymentStatus': 'paid',
        'refundRecord': ?refundRecord,
      }).toEntity();

  test('a paid order that stands reads Paid online', () {
    expect(paidOrder().paymentLabel, 'Paid online');
  });

  test('cancelling opens a refund: it reads in progress, not Paid', () {
    // The shape the shop wrote for BK-20261118-2132.
    final order = paidOrder(
      status: 'cancelled',
      refundRecord: {'status': 'requested', 'amount': 2934, 'reason': 'order_cancelled'},
    );
    expect(order.paymentLabel, 'Refund in progress');
  });

  test('money back from the gateway is named with its amount', () {
    final order = paidOrder(
      status: 'cancelled',
      refundRecord: {
        'status': 'processing',
        'amount': 2934,
        'gatewayRefunds': [
          {'status': 'processed', 'amount': 2900},
          {'status': 'pending', 'amount': 34},
        ],
      },
    );
    expect(order.paymentLabel, contains('Refunded'));
    expect(order.paymentLabel, contains('2,900'));
  });

  test('a completed record with no gateway list counts its amount', () {
    final order = paidOrder(
      status: 'refunded',
      refundRecord: {'status': 'completed', 'amount': 500},
    );
    expect(order.paymentLabel, contains('500'));
  });

  test('a refund the shop declined says so', () {
    final order = paidOrder(
      status: 'cancelled',
      refundRecord: {'status': 'rejected', 'amount': 2934},
    );
    expect(order.paymentLabel, 'Paid online · refund declined');
  });

  test('cancelled after paying, with no refund opened, is still owed', () {
    expect(paidOrder(status: 'cancelled').paymentLabel, 'Paid online · refund pending');
  });

  testWidgets('the order page shows it, not the bare payment status', (tester) async {
    final order = paidOrder(
      status: 'cancelled',
      refundRecord: {'status': 'requested', 'amount': 2934},
    );
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: OrderPaymentCard(order: order))));
    expect(find.text('Refund in progress'), findsOneWidget);
    expect(find.text('Paid online'), findsNothing);
  });
}
