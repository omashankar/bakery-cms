import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/order_refund.dart';
import '../../domain/entities/refund_state.dart';
import '../../domain/entities/refund_status.dart';
import 'gateway_refund_model.dart';

part 'order_refund_model.g.dart';

/// `refundRecord` on an order.
@JsonSerializable(createToJson: false)
class OrderRefundModel {
  const OrderRefundModel({
    required this.status,
    required this.amount,
    required this.gatewayRefunds,
  });

  factory OrderRefundModel.fromJson(Map<String, dynamic> json) => _$OrderRefundModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String status;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double amount;
  @JsonKey(fromJson: _gateway)
  final List<GatewayRefundModel> gatewayRefunds;

  /// The website's rule (`settledRefundAmount`): with gateway refunds, only
  /// the processed ones count; without, the amount counts only once the
  /// record says completed.
  OrderRefund toEntity() {
    final settled = gatewayRefunds.isNotEmpty
        ? gatewayRefunds
              .where((refund) => refund.isProcessed)
              .fold<double>(0, (sum, refund) => sum + refund.amount)
        : (status == RefundStatus.completed.apiValue ? amount : 0.0);
    return OrderRefund(
      status: RefundStatus.fromApi(status),
      settledAmount: settled,
      state: refundState,
    );
  }

  /// The website's `refundState`, line for line: completed is processed; a
  /// gateway refund still pending is processing; every gateway refund failed
  /// is failed (checked BEFORE rejected: a bounced refund leaves the record
  /// reading rejected too); a declined request is no refund at all.
  RefundState get refundState {
    if (status == RefundStatus.completed.apiValue) return RefundState.processed;
    if (gatewayRefunds.any((refund) => refund.status == GatewayRefundModel.pending)) {
      return RefundState.processing;
    }
    if (gatewayRefunds.isNotEmpty &&
        gatewayRefunds.every((refund) => refund.status == GatewayRefundModel.failed)) {
      return RefundState.failed;
    }
    if (status == RefundStatus.rejected.apiValue) return RefundState.notApplicable;
    if (status == RefundStatus.processing.apiValue) return RefundState.processing;
    return RefundState.pending;
  }

  static List<GatewayRefundModel> _gateway(Object? value) => [
    if (value is List)
      for (final refund in value)
        if (refund is Map<String, dynamic>) GatewayRefundModel.fromJson(refund),
  ];
}
