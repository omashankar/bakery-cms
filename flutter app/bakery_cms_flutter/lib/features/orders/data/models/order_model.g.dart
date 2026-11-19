// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderModel _$OrderModelFromJson(Map<String, dynamic> json) => OrderModel(
  id: JsonReaders.string(json['id']),
  orderNumber: JsonReaders.string(json['orderNumber']),
  items: OrderModel._lines(json['items']),
  totals: OrderModel._totals(json['totals']),
  address: OrderModel._address(json['address']),
  paymentMethod: JsonReaders.string(json['paymentMethod']),
  paymentStatus: JsonReaders.string(json['paymentStatus']),
  status: JsonReaders.string(json['status']),
  statusHistory: OrderModel._history(json['statusHistory']),
  placedAt: JsonReaders.string(json['placedAt']),
  estimatedDelivery: JsonReaders.string(json['estimatedDelivery']),
  deliverySlot: OrderModel._slot(json['deliverySlot']),
  orderNotes: json['orderNotes'] as String?,
  cancellationReason: json['cancellationReason'] as String?,
  couponCode: OrderModel._readCouponCode(json, 'couponCode') as String?,
  policyClass: OrderModel._readPolicyClass(json, 'policyClass') as String?,
  preparationStartedAt: json['preparationStartedAt'] as String?,
  refundRecord: OrderModel._refund(json['refundRecord']),
  termsAcceptedAt: OrderModel._text(OrderModel._readAcceptedAt(json, 'termsAcceptedAt')),
  gift: OrderModel._gift(OrderModel._readPersonalisation(json, 'gift')),
);
