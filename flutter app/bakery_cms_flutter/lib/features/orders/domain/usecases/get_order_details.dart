import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/order_details.dart';
import '../repositories/orders_repository.dart';

/// [String] params: the order number.
class GetOrderDetails implements UseCase<OrderDetails, String> {
  const GetOrderDetails(this._repository);

  final OrdersRepository _repository;

  @override
  Future<Either<Failure, OrderDetails>> call(String params) => _repository.getOrderDetails(params);
}
