// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_totals_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderTotalsModel _$OrderTotalsModelFromJson(Map<String, dynamic> json) => OrderTotalsModel(
  subtotal: JsonReaders.toDouble(json['subtotal']),
  delivery: JsonReaders.toDouble(json['delivery']),
  tax: JsonReaders.toDouble(json['tax']),
  discount: JsonReaders.toDouble(json['discount']),
  platformCharge: JsonReaders.toDouble(json['platformCharge']),
  giftWrapFee: JsonReaders.toDouble(json['giftWrapFee']),
  deliveryTierFee: JsonReaders.toDouble(json['deliveryTierFee']),
  total: JsonReaders.toDouble(json['total']),
  itemCount: JsonReaders.toInt(json['itemCount']),
  deliveryTierLabel: json['deliveryTierLabel'] as String?,
  taxLabel: json['taxLabel'] as String?,
);
