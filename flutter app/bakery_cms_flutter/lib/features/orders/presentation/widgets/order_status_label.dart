import '../../../../core/constants/strings/orders_strings.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/order_status.dart';
import '../../domain/entities/payment_status.dart';
import '../../domain/entities/refund_state.dart';
import '../../domain/entities/refund_status.dart';

/// Customer-facing words for each status.
extension OrderStatusLabel on OrderStatus {
  String get label => switch (this) {
    OrderStatus.pending => OrderStrings.statusPending,
    OrderStatus.confirmed => OrderStrings.statusConfirmed,
    OrderStatus.preparing => OrderStrings.statusPreparing,
    OrderStatus.ready => OrderStrings.statusReady,
    OrderStatus.outForDelivery => OrderStrings.statusOutForDelivery,
    OrderStatus.delivered => OrderStrings.statusDelivered,
    OrderStatus.cancelled => OrderStrings.statusCancelled,
    OrderStatus.refunded => OrderStrings.statusRefunded,
    OrderStatus.unknown => OrderStrings.statusUnknown,
  };
}

/// The refund's state, as the website's order page names it
/// (`REFUND_STATE_LABELS`); null when there is no refund to speak of.
extension RefundStateLabel on RefundState {
  String? get label => switch (this) {
    RefundState.notApplicable => null,
    RefundState.pending => OrderStrings.refundStatePending,
    RefundState.processing => OrderStrings.refundStateProcessing,
    RefundState.processed => OrderStrings.refundStateProcessed,
    RefundState.failed => OrderStrings.refundStateFailed,
  };
}

/// The payment line in the customer's words, refund included: the website's
/// `paymentText` (account-orders-page.tsx), with the refund read from the
/// gateway's own refunds (`refundState`), so a refund the bank bounced
/// never reads "in progress".
extension OrderPaymentLabel on Order {
  String get paymentLabel {
    final refund = this.refund;
    if (refund != null && refund.settledAmount > 0) {
      return OrderStrings.refundedAmount(MoneyFormatter.format(refund.settledAmount));
    }
    if (refund != null) {
      if (refund.state == RefundState.failed) return OrderStrings.paidRefundFailed;
      if (refund.status.isUnderWay || refund.state == RefundState.processing) {
        return OrderStrings.refundInProgress;
      }
      // The shop said no: said plainly, so the customer asks rather than waits.
      if (refund.status == RefundStatus.rejected) return OrderStrings.paidRefundDeclined;
    }
    // Cancelled after paying with no refund opened: the shop owes this money,
    // and "Paid online" alone would hide that.
    if (refund == null && status == OrderStatus.cancelled && paymentStatus == PaymentStatus.paid) {
      return OrderStrings.paidRefundPending;
    }
    return switch (paymentStatus) {
      PaymentStatus.paid => OrderStrings.paidOnline,
      PaymentStatus.cod =>
        status == OrderStatus.delivered ? OrderStrings.paidOnDelivery : OrderStrings.cashOnDelivery,
      PaymentStatus.refunded => OrderStrings.paymentRefunded,
      PaymentStatus.failed => OrderStrings.paymentFailedText,
      PaymentStatus.pending || PaymentStatus.unknown => OrderStrings.paymentPendingText,
    };
  }
}
