enum PaymentStatus {
  cod('cod'),
  paid('paid'),
  pending('pending'),
  failed('failed'),
  refunded('refunded'),
  unknown('');

  const PaymentStatus(this.apiValue);

  final String apiValue;

  static PaymentStatus fromApi(Object? value) => PaymentStatus.values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => PaymentStatus.unknown,
  );
}
