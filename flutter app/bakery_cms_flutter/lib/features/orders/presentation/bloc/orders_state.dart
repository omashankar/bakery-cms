import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/order.dart';

class OrdersState extends Equatable {
  const OrdersState({this.status = ViewStatus.initial, this.orders = const [], this.errorMessage});

  final ViewStatus status;
  final List<Order> orders;
  final String? errorMessage;

  OrdersState copyWith({ViewStatus? status, List<Order>? orders, String? errorMessage}) {
    return OrdersState(
      status: status ?? this.status,
      orders: orders ?? this.orders,
      errorMessage: errorMessage,
    );
  }

  @override
  List<Object?> get props => [status, orders, errorMessage];
}
