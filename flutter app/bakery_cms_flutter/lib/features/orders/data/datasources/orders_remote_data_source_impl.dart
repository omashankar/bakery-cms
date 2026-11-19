import 'package:flutter/foundation.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/order_model.dart';
import 'orders_remote_data_source.dart';

class OrdersRemoteDataSourceImpl implements OrdersRemoteDataSource {
  const OrdersRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  @override
  Future<List<OrderModel>> fetchMyOrders() async {
    final data = await _client.get(ApiEndpoints.myOrders);
    if (data is! List) throw const ServerException();
    final orders = <OrderModel>[];
    for (final raw in data) {
      // One unreadable order is skipped, not allowed to hide the rest.
      try {
        if (raw is Map<String, dynamic>) orders.add(OrderModel.fromJson(raw));
      } catch (error) {
        debugPrint('Skipped an order that could not be read: $error');
      }
    }
    return orders;
  }

  @override
  Future<OrderModel> cancelOrder(String orderNumber, {String? reason}) async {
    final data = await _client.post(
      ApiEndpoints.orderCancellation(orderNumber),
      body: {'reason': ?reason},
    );
    if (data is! Map<String, dynamic>) throw const ServerException();
    return OrderModel.fromJson(data);
  }

  @override
  Future<String> emailInvoice(String orderNumber, {required String email}) async {
    // No body: the shop reads the owner's email from the query and mails the
    // address on the order, never one the caller names.
    final data = await _client.post(ApiEndpoints.orderInvoiceEmail(orderNumber, email: email));
    final to = data is Map<String, dynamic> ? data[_toKey] : null;
    return to is String ? to : email;
  }

  static const String _toKey = 'to';
}
