/// Where the shop's refund for a cancelled, paid order stands
/// (`refundRecord.status`).
enum RefundStatus {
  requested('requested'),
  processing('processing'),
  completed('completed'),
  rejected('rejected'),
  unknown('');

  const RefundStatus(this.apiValue);

  final String apiValue;

  static RefundStatus fromApi(Object? value) => RefundStatus.values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => RefundStatus.unknown,
  );

  /// The shop has the refund in hand but no money has gone back yet.
  bool get isUnderWay => this == requested || this == processing;
}
