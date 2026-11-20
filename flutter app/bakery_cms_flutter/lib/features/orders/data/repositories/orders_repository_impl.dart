import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:fpdart/fpdart.dart' hide Order;

import '../../../../core/constants/app_strings.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../../../core/error/network_exception.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/order_events.dart';
import '../../domain/entities/order.dart';
import '../../domain/entities/order_details.dart';
import '../../domain/repositories/orders_repository.dart';
import '../datasources/orders_remote_data_source.dart';
import '../models/order_model.dart';

class OrdersRepositoryImpl implements OrdersRepository {
  /// [sessionChanges] fires whenever who is signed in changes; the cache is
  /// dropped then, so one customer never sees another's orders on a shared
  /// phone.
  OrdersRepositoryImpl(
    this._remote, {
    required Stream<Object?> sessionChanges,
    OrderEvents? orderEvents,
  }) : _orderEvents = orderEvents ?? OrderEvents() {
    _sessionSubscription = sessionChanges.listen((_) => _cache = null);
  }

  final OrdersRemoteDataSource _remote;
  final OrderEvents _orderEvents;
  late final StreamSubscription<Object?> _sessionSubscription;

  @override
  Stream<void> get changes => _orderEvents.changed;

  /// The last list the shop sent, newest first. Detail screens read from it
  /// rather than asking again.
  List<OrderModel>? _cache;

  @override
  Future<Either<Failure, List<Order>>> getMyOrders({bool forceRefresh = false}) => guard(() async {
    final orders = forceRefresh || _cache == null ? await _fetch() : _cache!;
    return orders.map((order) => order.toEntity()).toList();
  });

  @override
  Future<Either<Failure, OrderDetails>> getOrderDetails(String orderNumber) => guard(() async {
    // Fresh from the shop each time the detail opens: the cached list can
    // be minutes old, and a stale status would offer Cancel after the shop
    // had started preparing. The cache is only the fallback offline.
    OrderModel? model;
    try {
      model = _find(await _fetch(), orderNumber);
    } on NetworkException {
      model = _find(_cache, orderNumber);
      if (model == null) rethrow;
    }
    if (model == null) throw const ServerException(message: AppStrings.errorNotFound);
    return model.toDetails();
  });

  @override
  Future<Either<Failure, OrderDetails>> cancelOrder(String orderNumber, {String? reason}) =>
      guard(() async {
        final updated = await _remote.cancelOrder(orderNumber, reason: reason);
        _cache = _cache
            ?.map((order) => order.orderNumber == updated.orderNumber ? updated : order)
            .toList();
        _orderEvents.notifyChanged();
        return updated.toDetails();
      });

  @override
  Future<Either<Failure, String>> emailInvoice(String orderNumber, {required String email}) =>
      guard(() => _remote.emailInvoice(orderNumber, email: email));

  Future<List<OrderModel>> _fetch() async {
    final orders = await _remote.fetchMyOrders()
      ..sort((a, b) => b.placedAt.compareTo(a.placedAt));
    _cache = orders;
    return orders;
  }

  @visibleForTesting
  Future<void> dispose() => _sessionSubscription.cancel();

  static OrderModel? _find(List<OrderModel>? orders, String orderNumber) {
    if (orders == null) return null;
    for (final order in orders) {
      if (order.orderNumber == orderNumber) return order;
    }
    return null;
  }
}
