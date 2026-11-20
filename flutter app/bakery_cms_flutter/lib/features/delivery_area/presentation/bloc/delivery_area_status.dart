import '../../domain/entities/delivery_area.dart';
import '../../domain/entities/delivery_verdict.dart';

/// Where the customer's delivery PIN code stands.
enum DeliveryAreaStatus {
  /// No PIN code chosen on this device.
  none,

  /// Asking the shop about the chosen PIN code again.
  checking,

  /// The shop delivers to the chosen PIN code.
  delivers,

  /// Only to parts of it: the address decides at checkout.
  partly,

  /// The shop does not deliver there (or India Post has no such PIN).
  notDelivered,

  /// The last check failed; the chosen area (if any) is still the one shown.
  failure;

  /// What the shop's answer about [area] means for the customer.
  static DeliveryAreaStatus of(DeliveryArea? area) => switch (area?.verdict) {
    null => DeliveryAreaStatus.none,
    DeliveryVerdict.eligible => DeliveryAreaStatus.delivers,
    DeliveryVerdict.partly => DeliveryAreaStatus.partly,
    DeliveryVerdict.outside || DeliveryVerdict.unknown => DeliveryAreaStatus.notDelivered,
  };
}
