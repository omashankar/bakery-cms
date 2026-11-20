import 'package:bakery_cms_flutter/features/orders/data/models/order_model.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order_status.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/payment_status.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../order_fixtures.dart';

void main() {
  group('OrderModel.fromJson', () {
    test('reads a placed order the way the shop sends it', () {
      final order = OrderModel.fromJson(orderJson()).toEntity();

      expect(order.orderNumber, 'BK-20261116-4821');
      expect(order.status, OrderStatus.pending);
      expect(order.paymentStatus, PaymentStatus.cod);
      expect(order.isCashOnDelivery, isTrue);
      expect(order.items, hasLength(2));
      // Labelled with the shop's own word for the size, as the website prints them.
      expect(order.items.first.choices, ['Weight: 1.5 Kg', 'Flavour: Caramel Butterscotch', 'Eggless']);
      expect(order.items.first.message, 'Happy Birthday Riya');
      expect(order.items.last.price, 179);
      expect(order.items.last.lineTotal, 358);
      expect(order.totals.total, 1523.85);
      expect(order.totals.itemCount, 3);
      expect(order.totals.taxLabel, 'GST (5%)');
      expect(order.address.singleLine, '12 Park Road, Near the temple, Kota, Rajasthan 324001');
      expect(order.address.label, 'Home');
      expect(order.deliveryDate, '2026-11-17');
      expect(order.deliveryTimeSlot, '4:00 PM – 5:00 PM');
      expect(order.deliveryTierLabel, 'Fixed Time Delivery');
      expect(order.couponCode, 'SWEET100');
      expect(order.orderNotes, 'Please call before arriving');
      expect(order.statusHistory.single.status, OrderStatus.pending);
    });

    test('an order missing whole blocks still reads, with safe defaults', () {
      final order = OrderModel.fromJson(const {
        'id': 'o1',
        'orderNumber': 'BK-1',
        'status': 'out_for_delivery',
        'items': [
          'not a line',
          {'productSlug': 'x', 'name': 'X', 'price': '120', 'quantity': 1},
        ],
      }).toEntity();

      expect(order.status, OrderStatus.outForDelivery);
      expect(order.items.single.price, 120);
      expect(order.totals.total, 0);
      expect(order.address.fullName, '');
      expect(order.deliveryDate, isNull);
      expect(order.paymentStatus, PaymentStatus.unknown);
    });
  });

  group('can the customer cancel?', () {
    test('yes, while pending and nothing has started', () {
      expect(OrderModel.fromJson(orderJson()).toDetails().canCancel, isTrue);
    });

    test('yes, when confirmed and the policy is made to order', () {
      final json = orderJson(status: 'confirmed', policyClass: 'made_to_order');
      expect(OrderModel.fromJson(json).toDetails().canCancel, isTrue);
    });

    test('no, when the products are non-cancellable', () {
      final json = orderJson(policyClass: 'non_cancellable');
      expect(OrderModel.fromJson(json).toDetails().canCancel, isFalse);
    });

    test('no, once preparation has started', () {
      final json = orderJson(status: 'preparing');
      expect(OrderModel.fromJson(json).toDetails().canCancel, isFalse);
    });

    test('no, when the history shows preparation started even if moved back', () {
      final json = orderJson(
        status: 'confirmed',
        statusHistory: [
          {'status': 'pending', 'at': '2026-11-16T10:15:00.000Z'},
          {'status': 'preparing', 'at': '2026-11-16T11:00:00.000Z'},
          {'status': 'confirmed', 'at': '2026-11-16T11:05:00.000Z'},
        ],
      );
      expect(OrderModel.fromJson(json).toDetails().canCancel, isFalse);
    });

    test('no, for a closed order', () {
      expect(OrderModel.fromJson(orderJson(status: 'cancelled')).toDetails().canCancel, isFalse);
      expect(OrderModel.fromJson(orderJson(status: 'delivered')).toDetails().canCancel, isFalse);
    });

    test('an order without a stored policy is offered (the server decides)', () {
      final json = orderJson(policyClass: null);
      expect(OrderModel.fromJson(json).toDetails().canCancel, isTrue);
    });
  });
}
