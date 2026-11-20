/// The shop's verdict on a map pin (`status` from
/// `POST /api/checkout/delivery-pin`, the website's `PinCheck`).
enum PinStatus {
  /// Inside a delivery area, and agreeing with the address.
  eligible,

  /// Outside every area the shop delivers to.
  outside,

  /// The pin and the typed address disagree (a different PIN, or state).
  mismatch,

  /// No usable pin yet (a town, not a door).
  missing,

  /// The pin itself was not a place.
  invalid,

  /// The check could not be made right now.
  unavailable,

  /// Any other refusal; its message says why.
  refused;

  static PinStatus fromApi(Object? value) => switch (value) {
    'eligible' => PinStatus.eligible,
    'outside' => PinStatus.outside,
    'mismatch' => PinStatus.mismatch,
    'missing' => PinStatus.missing,
    'invalid' => PinStatus.invalid,
    'unavailable' => PinStatus.unavailable,
    _ => PinStatus.refused,
  };

  /// A pin still to be placed, or a check that could not be made: a warning,
  /// not a refusal (the website draws these amber).
  bool get isSoft => this == missing || this == unavailable;
}
