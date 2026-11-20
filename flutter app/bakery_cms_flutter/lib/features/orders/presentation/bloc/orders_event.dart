import 'package:equatable/equatable.dart';

sealed class OrdersEvent extends Equatable {
  const OrdersEvent();

  @override
  List<Object?> get props => const [];
}

/// Opening the screen. Always asks the shop: an order placed a minute ago
/// must be on the list.
final class OrdersRequested extends OrdersEvent {
  const OrdersRequested();
}

/// Pull to refresh. Keeps the current list on screen while it loads.
final class OrdersRefreshed extends OrdersEvent {
  const OrdersRefreshed();
}
