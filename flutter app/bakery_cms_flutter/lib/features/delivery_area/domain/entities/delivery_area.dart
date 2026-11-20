import 'package:equatable/equatable.dart';

import 'delivery_verdict.dart';

/// A PIN code the customer chose and the shop's answer about it.
///
/// Advice only, kept on the device so it shows on the next launch without a
/// request: checkout checks the actual door before anything is priced.
class DeliveryArea extends Equatable {
  const DeliveryArea({
    required this.pincode,
    required this.verdict,
    this.city = '',
    this.state = '',
    this.charge,
    this.minDeliveryDays,
    this.freeDeliveryThreshold,
    this.priceMayVary = false,
    this.zonesRequired = true,
  });

  /// Six digits, India Post's format.
  final String pincode;
  final DeliveryVerdict verdict;

  /// The PIN's district ("Kota") and state, when India Post knows them.
  final String city;
  final String state;

  /// The delivery charge for this PIN, when delivered.
  final double? charge;

  /// The area's own preparation time in days; the shop takes the larger of
  /// this and its own lead time.
  final int? minDeliveryDays;

  /// Orders above this deliver free, when the shop sets one.
  final double? freeDeliveryThreshold;

  /// The PIN's offices are charged differently: the door may pay another rate.
  final bool priceMayVary;

  /// False when the shop has no delivery areas and takes every address.
  final bool zonesRequired;

  bool get delivers => verdict == DeliveryVerdict.eligible;

  @override
  List<Object?> get props => [
    pincode,
    verdict,
    city,
    state,
    charge,
    minDeliveryDays,
    freeDeliveryThreshold,
    priceMayVary,
    zonesRequired,
  ];
}
