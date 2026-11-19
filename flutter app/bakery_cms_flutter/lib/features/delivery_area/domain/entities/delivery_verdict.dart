/// What the shop said about a PIN code (`POST /api/checkout/delivery-pin`
/// with a pincode alone).
enum DeliveryVerdict {
  /// Most of the PIN's post offices are in a delivery area: yes.
  eligible,

  /// Only some are: the door decides, at checkout.
  partly,

  /// None are, and the shop does not deliver outside its areas.
  outside,

  /// India Post has no such PIN.
  unknown;

  /// The server's word. `refused` (and anything new) reads as [outside]: a
  /// "no" the app does not understand must never read as a yes.
  static DeliveryVerdict fromApi(Object? value) => switch (value) {
    'eligible' => DeliveryVerdict.eligible,
    'partly' => DeliveryVerdict.partly,
    'unknown' => DeliveryVerdict.unknown,
    _ => DeliveryVerdict.outside,
  };

  /// What is stored on the device: the same word the server uses.
  String get apiName => name;
}
