import 'package:equatable/equatable.dart';

import 'order_status.dart';

class OrderStatusEvent extends Equatable {
  const OrderStatusEvent({required this.status, required this.at});

  final OrderStatus status;

  /// ISO timestamp.
  final String at;

  @override
  List<Object?> get props => [status, at];
}
