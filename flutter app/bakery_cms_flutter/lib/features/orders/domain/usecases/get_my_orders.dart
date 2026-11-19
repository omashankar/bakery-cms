import 'package:fpdart/fpdart.dart' hide Order;

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/order.dart';
import '../repositories/orders_repository.dart';
import 'get_my_orders_params.dart';

class GetMyOrders implements UseCase<List<Order>, GetMyOrdersParams> {
  const GetMyOrders(this._repository);

  final OrdersRepository _repository;

  @override
  Future<Either<Failure, List<Order>>> call(GetMyOrdersParams params) =>
      _repository.getMyOrders(forceRefresh: params.forceRefresh);
}
