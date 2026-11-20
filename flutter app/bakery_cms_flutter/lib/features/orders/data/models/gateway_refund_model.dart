import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';

part 'gateway_refund_model.g.dart';

/// One refund the payment gateway reported (`refundRecord.gatewayRefunds[]`).
@JsonSerializable(createToJson: false)
class GatewayRefundModel {
  const GatewayRefundModel({required this.status, required this.amount});

  factory GatewayRefundModel.fromJson(Map<String, dynamic> json) =>
      _$GatewayRefundModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String status;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double amount;

  static const String processed = 'processed';
  static const String pending = 'pending';
  static const String failed = 'failed';

  bool get isProcessed => status == processed;
}
