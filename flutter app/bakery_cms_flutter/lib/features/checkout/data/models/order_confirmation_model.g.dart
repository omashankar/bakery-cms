// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'order_confirmation_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OrderConfirmationModel _$OrderConfirmationModelFromJson(Map<String, dynamic> json) =>
    OrderConfirmationModel(
      id: JsonReaders.string(json['id']),
      orderNumber: JsonReaders.string(json['orderNumber']),
      paymentMethod: JsonReaders.string(json['paymentMethod']),
      totals: json['totals'] == null
          ? null
          : OrderTotalsModel.fromJson(json['totals'] as Map<String, dynamic>),
    );
