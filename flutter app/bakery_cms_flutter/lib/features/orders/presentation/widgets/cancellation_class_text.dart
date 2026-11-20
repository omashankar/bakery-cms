import '../../../../core/constants/strings/orders_strings.dart';
import '../../domain/entities/cancellation_class.dart';

/// The rule in one customer-facing line: the website's
/// `CANCELLATION_CLASS_CUSTOMER_TEXT` (features/orders/lib/cancellation-policy.ts).
extension CancellationClassText on CancellationClass {
  String get customerText => switch (this) {
    CancellationClass.standard => OrderStrings.cancellableUntilPreparing,
    CancellationClass.madeToOrder => OrderStrings.cancellableUntilPreparing,
    CancellationClass.nonCancellable => OrderStrings.notCancellable,
  };
}
