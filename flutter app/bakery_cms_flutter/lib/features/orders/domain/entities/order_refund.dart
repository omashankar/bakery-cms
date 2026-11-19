import 'package:equatable/equatable.dart';

import 'refund_state.dart';
import 'refund_status.dart';

/// The refund on an order, as the customer may see it.
class OrderRefund extends Equatable {
  const OrderRefund({
    required this.status,
    this.settledAmount = 0,
    this.state = RefundState.pending,
  });

  /// What the shop's record says (`refundRecord.status`).
  final RefundStatus status;

  /// Money that has actually gone back: the gateway's processed refunds, or
  /// the record's amount once it says completed. Never a promise.
  final double settledAmount;

  /// Where the money stands, by the gateway's own refunds (see [RefundState]).
  final RefundState state;

  @override
  List<Object?> get props => [status, settledAmount, state];
}
