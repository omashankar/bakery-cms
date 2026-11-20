import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/razorpay_order.dart';

part 'razorpay_order_model.g.dart';

/// `POST /api/razorpay/order`, a bare object (no envelope).
@JsonSerializable(createToJson: false)
class RazorpayOrderModel {
  const RazorpayOrderModel({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.keyId,
  });

  factory RazorpayOrderModel.fromJson(Map<String, dynamic> json) =>
      _$RazorpayOrderModelFromJson(json);

  final String orderId;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int amount;
  final String currency;
  final String keyId;

  RazorpayOrder toEntity() =>
      RazorpayOrder(orderId: orderId, amount: amount, currency: currency, keyId: keyId);
}
