import 'package:equatable/equatable.dart';

import 'order.dart';

/// An order plus what the customer may do with it.
class OrderDetails extends Equatable {
  const OrderDetails({required this.order, required this.canCancel});

  final Order order;

  /// Worked out by `CustomerCancellationPolicy` from fields [Order] does not
  /// carry (the policy class and when preparation started).
  final bool canCancel;

  @override
  List<Object?> get props => [order, canCancel];
}
