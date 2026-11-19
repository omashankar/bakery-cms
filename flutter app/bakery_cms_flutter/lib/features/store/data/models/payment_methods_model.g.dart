// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment_methods_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PaymentMethodsModel _$PaymentMethodsModelFromJson(Map<String, dynamic> json) => PaymentMethodsModel(
  cod: JsonReaders.boolTrue(json['cod']),
  upi: JsonReaders.boolOr(json['upi']),
  card: JsonReaders.boolOr(json['card']),
  razorpay: JsonReaders.boolOr(json['razorpay']),
);
