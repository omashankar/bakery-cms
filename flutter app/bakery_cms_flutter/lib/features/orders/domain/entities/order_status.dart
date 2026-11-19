/// Where an order is in its life (`OrderStatus` on the server).
enum OrderStatus {
  pending('pending'),
  confirmed('confirmed'),
  preparing('preparing'),
  ready('ready'),
  outForDelivery('out_for_delivery'),
  delivered('delivered'),
  cancelled('cancelled'),
  refunded('refunded'),
  unknown('');

  const OrderStatus(this.apiValue);

  final String apiValue;

  static OrderStatus fromApi(Object? value) => OrderStatus.values.firstWhere(
    (status) => status.apiValue == value,
    orElse: () => OrderStatus.unknown,
  );

  bool get isClosed =>
      this == OrderStatus.delivered ||
      this == OrderStatus.cancelled ||
      this == OrderStatus.refunded;

  /// The steps an order normally walks, for a progress tracker.
  static const List<OrderStatus> journey = [
    OrderStatus.pending,
    OrderStatus.confirmed,
    OrderStatus.preparing,
    OrderStatus.ready,
    OrderStatus.outForDelivery,
    OrderStatus.delivered,
  ];
}
