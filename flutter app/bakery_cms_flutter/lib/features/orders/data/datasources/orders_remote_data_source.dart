import '../models/order_model.dart';

abstract interface class OrdersRemoteDataSource {
  Future<List<OrderModel>> fetchMyOrders();

  Future<OrderModel> cancelOrder(String orderNumber, {String? reason});

  /// Asks the shop to email this order's invoice to the address ON the
  /// order; answers that address. [email] proves ownership, as the website's
  /// lookup does. It sends an email: never call it from a probe.
  Future<String> emailInvoice(String orderNumber, {required String email});
}
