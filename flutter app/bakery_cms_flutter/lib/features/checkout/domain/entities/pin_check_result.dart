import 'package:equatable/equatable.dart';

import 'pin_found.dart';
import 'pin_region.dart';
import 'pin_status.dart';

/// What `POST /api/checkout/delivery-pin` said about a pin. Advice only: the
/// quote checks the pin again before anything is priced.
///
/// Every field the website's `PinCheck` reads (delivery-pin-picker.tsx).
class PinCheckResult extends Equatable {
  const PinCheckResult({
    required this.status,
    this.message,
    this.charge,
    this.city,
    this.state,
    this.postalCode,
    this.formattedAddress,
    this.minDeliveryDays,
    this.freeDeliveryThreshold,
    this.region,
    this.pincodeSure = false,
    this.otherPincodes = const [],
    this.cityNote,
    this.field,
    this.found,
    this.kmToArea,
  });

  final PinStatus status;
  final String? message;

  /// The delivery charge for this area, when eligible.
  final double? charge;
  final String? city;
  final String? state;

  /// India Post's PIN at the pin (nearest post office); null where none is near.
  final String? postalCode;
  final String? formattedAddress;

  /// The area's own preparation time in days. The shop takes the larger of
  /// this and its own lead time, so the date list must too.
  final int? minDeliveryDays;

  /// The order total past which this delivery is free.
  final double? freeDeliveryThreshold;
  final PinRegion? region;

  /// False when a PIN line runs close by: [otherPincodes] may be the
  /// customer's.
  final bool pincodeSure;
  final List<String> otherPincodes;

  /// A word about the town at the pin, eligible answers only.
  final String? cityNote;

  /// The address box a refusal is about: `location`, `pincode` or `state`.
  final String? field;

  /// What the map shows at a refused pin.
  final PinFound? found;

  /// Outside: how far the nearest delivery area is, in km.
  final double? kmToArea;

  bool get isEligible => status == PinStatus.eligible;

  /// The PIN the shop suggests instead of the one typed, for a refusal about
  /// the PIN: the website's "Use PIN X" button, offered only when it differs.
  String? suggestedPincode(String typed) {
    if (status != PinStatus.mismatch || field != 'pincode') return null;
    final suggested = found?.postalCode?.trim() ?? '';
    return suggested.isEmpty || suggested == typed.trim() ? null : suggested;
  }

  /// The PINs an eligible pin offers, never the one already typed: the one
  /// at the pin, and its neighbours when a PIN line runs close by (the
  /// website's `PinAtPin`).
  List<String> pincodeChoices(String typed) {
    final atPin = postalCode?.trim() ?? '';
    if (!isEligible || atPin.isEmpty) return const [];
    return [
      atPin,
      if (!pincodeSure) ...otherPincodes,
    ].where((code) => code != typed.trim()).toList();
  }

  @override
  List<Object?> get props => [
    status,
    message,
    charge,
    city,
    state,
    postalCode,
    formattedAddress,
    minDeliveryDays,
    freeDeliveryThreshold,
    region,
    pincodeSure,
    otherPincodes,
    cityNote,
    field,
    found,
    kmToArea,
  ];
}
