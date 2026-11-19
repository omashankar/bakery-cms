// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'razorpay_order_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RazorpayOrderModel _$RazorpayOrderModelFromJson(Map<String, dynamic> json) => RazorpayOrderModel(
  orderId: json['orderId'] as String,
  amount: JsonReaders.toInt(json['amount']),
  currency: json['currency'] as String,
  keyId: json['keyId'] as String,
);
