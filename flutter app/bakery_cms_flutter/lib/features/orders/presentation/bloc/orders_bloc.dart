import 'dart:async';

import 'package:bloc_concurrency/bloc_concurrency.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/usecases/get_my_orders.dart';
import '../../domain/usecases/get_my_orders_params.dart';
import '../../domain/usecases/watch_order_changes.dart';
import 'orders_event.dart';
import 'orders_state.dart';

class OrdersBloc extends Bloc<OrdersEvent, OrdersState> {
  OrdersBloc(this._getMyOrders, {WatchOrderChanges? watchOrderChanges})
    : super(const OrdersState()) {
    // One handler for every reason to load, and the newest wins: a change
    // arriving mid-load must not be dropped, or the list shows the order as
    // it was before the change.
    on<OrdersEvent>(_onLoad, transformer: restartable());

    // The list lives on in its tab, so it is told when an order is placed or
    // cancelled elsewhere instead of only loading when first opened.
    _changes = watchOrderChanges?.call().listen((_) => add(const OrdersRefreshed()));
  }

  final GetMyOrders _getMyOrders;
  StreamSubscription<void>? _changes;

  Future<void> _onLoad(OrdersEvent event, Emitter<OrdersState> emit) async {
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _getMyOrders(const GetMyOrdersParams(forceRefresh: true));
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (orders) => emit(state.copyWith(status: ViewStatus.success, orders: orders)),
    );
  }

  @override
  Future<void> close() async {
    await _changes?.cancel();
    return super.close();
  }
}
