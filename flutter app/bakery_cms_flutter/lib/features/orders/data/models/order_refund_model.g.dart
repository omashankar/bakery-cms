// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_refund_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderRefundModel _$OrderRefundModelFromJson(Map<String, dynamic> json) => OrderRefundModel(
  status: JsonReaders.string(json['status']),
  amount: JsonReaders.toDouble(json['amount']),
  gatewayRefunds: OrderRefundModel._gateway(json['gatewayRefunds']),
);
