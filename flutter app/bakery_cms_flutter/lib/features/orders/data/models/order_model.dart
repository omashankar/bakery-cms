import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/cancellation_class.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/order_details.dart';
import '../../domain/entities/order_gift.dart';
import '../../domain/entities/order_status.dart';
import '../../domain/entities/payment_status.dart';
import '../../domain/services/customer_cancellation_policy.dart';
import 'delivery_slot_model.dart';
import 'order_address_model.dart';
import 'order_line_model.dart';
import 'order_refund_model.dart';
import 'order_status_event_model.dart';
import 'order_totals_model.dart';

part 'order_model.g.dart';

/// A placed order as the customer endpoints answer it (`PlacedOrder` minus
/// staff-only fields).
///
/// Every nested read is forgiving: an order written by an older version of
/// the shop may lack a block, and that must not hide the customer's history.
@JsonSerializable(createToJson: false)
class OrderModel {
  const OrderModel({
    required this.id,
    required this.orderNumber,
    required this.items,
    required this.totals,
    required this.address,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.status,
    required this.statusHistory,
    required this.placedAt,
    required this.estimatedDelivery,
    this.deliverySlot,
    this.orderNotes,
    this.cancellationReason,
    this.couponCode,
    this.policyClass,
    this.preparationStartedAt,
    this.refundRecord,
    this.termsAcceptedAt,
    this.gift,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json) => _$OrderModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String orderNumber;
  @JsonKey(fromJson: _lines)
  final List<OrderLineModel> items;
  @JsonKey(fromJson: _totals)
  final OrderTotalsModel totals;
  @JsonKey(fromJson: _address)
  final OrderAddressModel address;
  @JsonKey(fromJson: JsonReaders.string)
  final String paymentMethod;
  @JsonKey(fromJson: JsonReaders.string)
  final String paymentStatus;
  @JsonKey(fromJson: JsonReaders.string)
  final String status;
  @JsonKey(fromJson: _history)
  final List<OrderStatusEventModel> statusHistory;
  @JsonKey(fromJson: JsonReaders.string)
  final String placedAt;
  @JsonKey(fromJson: JsonReaders.string)
  final String estimatedDelivery;
  @JsonKey(fromJson: _slot)
  final DeliverySlotModel? deliverySlot;
  final String? orderNotes;
  final String? cancellationReason;
  @JsonKey(readValue: _readCouponCode)
  final String? couponCode;

  /// `cancellationPolicy.policyClass`, frozen on the order when it was placed.
  @JsonKey(readValue: _readPolicyClass)
  final String? policyClass;
  final String? preparationStartedAt;

  /// The shop's refund for a cancelled, paid order, when it opened one.
  @JsonKey(fromJson: _refund)
  final OrderRefundModel? refundRecord;

  /// `cancellationPolicy.acceptedAt`: the server copies the checkout's
  /// `personalisation.termsAcceptedAt` there (order.service.ts).
  @JsonKey(readValue: _readAcceptedAt, fromJson: _text)
  final String? termsAcceptedAt;

  /// `personalisation`.
  @JsonKey(readValue: _readPersonalisation, fromJson: _gift)
  final OrderGift? gift;

  Order toEntity() => Order(
    id: id,
    orderNumber: orderNumber,
    items: items.map((line) => line.toEntity()).toList(),
    totals: totals.toEntity(),
    address: address.toEntity(),
    paymentMethod: paymentMethod,
    paymentStatus: PaymentStatus.fromApi(paymentStatus),
    status: OrderStatus.fromApi(status),
    placedAt: placedAt,
    estimatedDelivery: estimatedDelivery,
    statusHistory: statusHistory.map((event) => event.toEntity()).toList(),
    deliveryDate: _blankToNull(deliverySlot?.date),
    deliveryTimeSlot: _blankToNull(deliverySlot?.timeSlot),
    deliveryTierLabel: _blankToNull(deliverySlot?.tierLabel) ?? totals.deliveryTierLabel,
    orderNotes: _blankToNull(orderNotes),
    cancellationReason: _blankToNull(cancellationReason),
    couponCode: _blankToNull(couponCode),
    refund: refundRecord?.toEntity(),
    gift: gift,
    policyClass: CancellationClass.fromApi(policyClass),
    termsAcceptedAt: termsAcceptedAt,
  );

  OrderDetails toDetails() {
    final order = toEntity();
    return OrderDetails(
      order: order,
      canCancel: CustomerCancellationPolicy.allows(
        status: order.status,
        policyClass: CancellationClass.fromApi(policyClass),
        preparationStartedAt: preparationStartedAt,
        statusHistory: order.statusHistory,
      ),
    );
  }

  static String? _blankToNull(String? value) =>
      (value == null || value.trim().isEmpty) ? null : value;

  static List<OrderLineModel> _lines(Object? value) => [
    if (value is List)
      for (final line in value)
        if (line is Map<String, dynamic>) OrderLineModel.fromJson(line),
  ];

  static List<OrderStatusEventModel> _history(Object? value) => [
    if (value is List)
      for (final event in value)
        if (event is Map<String, dynamic>) OrderStatusEventModel.fromJson(event),
  ];

  static OrderTotalsModel _totals(Object? value) =>
      OrderTotalsModel.fromJson(value is Map<String, dynamic> ? value : const {});

  static OrderAddressModel _address(Object? value) =>
      OrderAddressModel.fromJson(value is Map<String, dynamic> ? value : const {});

  static OrderRefundModel? _refund(Object? value) =>
      value is Map<String, dynamic> ? OrderRefundModel.fromJson(value) : null;

  static DeliverySlotModel? _slot(Object? value) =>
      value is Map<String, dynamic> ? DeliverySlotModel.fromJson(value) : null;

  static Object? _readCouponCode(Map<dynamic, dynamic> json, String key) {
    final coupon = json['coupon'];
    return coupon is Map ? coupon['code'] : null;
  }

  static Object? _readAcceptedAt(Map<dynamic, dynamic> json, String key) {
    final policy = json['cancellationPolicy'];
    return policy is Map ? policy['acceptedAt'] : null;
  }

  static Object? _readPersonalisation(Map<dynamic, dynamic> json, String key) =>
      json['personalisation'];

  static String? _text(Object? value) =>
      value is String && value.trim().isNotEmpty ? value.trim() : null;

  static OrderGift? _gift(Object? value) {
    if (value is! Map) return null;
    final sender = value['sender'];
    final gift = OrderGift(
      occasion: _text(value['occasion']),
      message: _text(value['message']),
      senderName: sender is Map ? _text(sender['name']) : null,
      senderPhone: sender is Map ? _text(sender['phone']) : null,
    );
    return gift == const OrderGift() ? null : gift;
  }

  static Object? _readPolicyClass(Map<dynamic, dynamic> json, String key) {
    final policy = json['cancellationPolicy'];
    return policy is Map ? policy['policyClass'] : null;
  }
}
