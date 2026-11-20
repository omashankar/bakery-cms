enum PaymentMethod {
  /// Cash on delivery.
  cod('cod'),

  /// UPI, cards and wallets, through the Razorpay checkout.
  online('razorpay');

  const PaymentMethod(this.apiValue);

  final String apiValue;
}
