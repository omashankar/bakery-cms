import 'package:equatable/equatable.dart';

import '../../../orders/domain/entities/order_totals.dart';
import 'applied_coupon.dart';

/// A cart the shop priced. [draftId] is what a payment and an order are
/// opened against, so the amount charged is one the shop computed.
class Quote extends Equatable {
  const Quote({required this.draftId, required this.totals, this.coupon, this.rejectedCoupon});

  final String draftId;
  final OrderTotals totals;
  final AppliedCoupon? coupon;

  /// A code the shop did not honour, reported rather than silently dropped.
  final String? rejectedCoupon;

  @override
  List<Object?> get props => [draftId, totals, coupon, rejectedCoupon];
}
