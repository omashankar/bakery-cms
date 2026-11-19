/// Why the final price differs from the one the customer was shown.
enum PriceChangeReason {
  /// The coupon is no longer valid for this order.
  couponRejected,

  /// The total moved, typically the delivery charge for the pinned address.
  totalChanged,

  /// No total had been shown yet.
  notShown,
}
