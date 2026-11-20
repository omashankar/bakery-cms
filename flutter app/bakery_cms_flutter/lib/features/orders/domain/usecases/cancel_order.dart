import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/order_details.dart';
import '../repositories/orders_repository.dart';
import 'cancel_order_params.dart';

class CancelOrder implements UseCase<OrderDetails, CancelOrderParams> {
  const CancelOrder(this._repository);

  static const int maxReasonLength = 300;

  final OrdersRepository _repository;

  @override
  Future<Either<Failure, OrderDetails>> call(CancelOrderParams params) {
    final reason = params.reason?.trim();
    return _repository.cancelOrder(
      params.orderNumber,
      reason: (reason == null || reason.isEmpty)
          ? null
          : reason.substring(0, reason.length.clamp(0, maxReasonLength)),
    );
  }
}
