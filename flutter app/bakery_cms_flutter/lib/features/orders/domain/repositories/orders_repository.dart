import 'package:fpdart/fpdart.dart' hide Order;

import '../../../../core/error/failure.dart';
import '../entities/order.dart';
import '../entities/order_details.dart';

/// The signed-in customer's own orders. The shop keys them on the session,
/// never on anything the app sends.
abstract interface class OrdersRepository {
  /// Newest first. Served from memory unless [forceRefresh].
  Future<Either<Failure, List<Order>>> getMyOrders({bool forceRefresh = false});

  Future<Either<Failure, OrderDetails>> getOrderDetails(String orderNumber);

  Future<Either<Failure, OrderDetails>> cancelOrder(String orderNumber, {String? reason});

  /// Emails the order's invoice to the address on it; answers that address.
  Future<Either<Failure, String>> emailInvoice(String orderNumber, {required String email});

  /// Fires when the orders changed on the shop: one was placed or cancelled.
  Stream<void> get changes;
}
