import '../entities/cancellation_class.dart';
import '../entities/order_status.dart';
import '../entities/order_status_event.dart';

/// May the customer cancel this order themselves?
///
/// Mirrors `customerCancellation` in the shop's
/// `features/orders/lib/cancellation-policy.ts`, so the Cancel button only
/// appears when the server would accept it. The server still decides, and
/// its refusal message is what the customer sees if they disagree.
abstract final class CustomerCancellationPolicy {
  /// Statuses from which the shop has started work on the order.
  static const Set<OrderStatus> _started = {
    OrderStatus.preparing,
    OrderStatus.ready,
    OrderStatus.outForDelivery,
    OrderStatus.delivered,
  };

  static bool allows({
    required OrderStatus status,
    required CancellationClass policyClass,
    String? preparationStartedAt,
    List<OrderStatusEvent> statusHistory = const [],
  }) {
    final notStarted = status == OrderStatus.pending || status == OrderStatus.confirmed;
    if (!notStarted) return false;
    if (policyClass == CancellationClass.nonCancellable) return false;
    if (preparationStartedAt != null && preparationStartedAt.isNotEmpty) return false;
    return !statusHistory.any((event) => _started.contains(event.status));
  }
}
