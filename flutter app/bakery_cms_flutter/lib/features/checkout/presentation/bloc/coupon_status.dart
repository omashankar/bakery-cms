/// Where the customer's coupon stands. "Applied" only once the shop priced a
/// quote with it: showing it applied the moment it was typed was showing a
/// discount the shop had not granted.
enum CouponStatus {
  /// No code entered.
  none,

  /// The shop is pricing the cart with it.
  checking,

  /// The latest quote carries it.
  applied,

  /// The shop said no.
  rejected,

  /// Pricing failed (offline), so it is not known to apply.
  unconfirmed,
}
