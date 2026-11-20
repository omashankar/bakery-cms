import 'package:equatable/equatable.dart';

import 'cancellation_class.dart';
import 'order_address.dart';
import 'order_gift.dart';
import 'order_line.dart';
import 'order_refund.dart';
import 'order_status.dart';
import 'order_status_event.dart';
import 'order_totals.dart';
import 'payment_status.dart';

/// A placed order, as the customer is allowed to see it.
class Order extends Equatable {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.items,
    required this.totals,
    required this.address,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.status,
    required this.placedAt,
    required this.estimatedDelivery,
    this.statusHistory = const [],
    this.deliveryDate,
    this.deliveryTimeSlot,
    this.deliveryTierLabel,
    this.orderNotes,
    this.cancellationReason,
    this.couponCode,
    this.refund,
    this.gift,
    this.policyClass = CancellationClass.standard,
    this.termsAcceptedAt,
  });

  final String id;

  /// "BK-20261116-4821": what the customer quotes to the shop.
  final String orderNumber;
  final List<OrderLine> items;
  final OrderTotals totals;
  final OrderAddress address;

  /// `cod`, `razorpay`, `upi` or `card`, as stored.
  final String paymentMethod;
  final PaymentStatus paymentStatus;
  final OrderStatus status;

  /// ISO timestamps.
  final String placedAt;
  final String estimatedDelivery;
  final List<OrderStatusEvent> statusHistory;

  /// `YYYY-MM-DD` and the booked window, when the customer chose a slot.
  final String? deliveryDate;
  final String? deliveryTimeSlot;
  final String? deliveryTierLabel;
  final String? orderNotes;
  final String? cancellationReason;
  final String? couponCode;

  /// The shop's refund, once a paid order was cancelled.
  final OrderRefund? refund;

  /// The occasion, gift message and sender, when the customer gave any.
  final OrderGift? gift;

  /// The cancellation rule this order was placed under (the order's copy).
  final CancellationClass policyClass;

  /// When the shop's terms were ticked at checkout
  /// (`cancellationPolicy.acceptedAt`, ISO). Null on an order without one.
  final String? termsAcceptedAt;

  bool get isCashOnDelivery => paymentMethod == 'cod';

  @override
  List<Object?> get props => [
    id,
    orderNumber,
    items,
    totals,
    address,
    paymentMethod,
    paymentStatus,
    status,
    placedAt,
    estimatedDelivery,
    statusHistory,
    deliveryDate,
    deliveryTimeSlot,
    deliveryTierLabel,
    orderNotes,
    cancellationReason,
    couponCode,
    refund,
    gift,
    policyClass,
    termsAcceptedAt,
  ];
}
