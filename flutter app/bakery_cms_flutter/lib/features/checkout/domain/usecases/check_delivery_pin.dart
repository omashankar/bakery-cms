import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/pin_check_request.dart';
import '../entities/pin_check_result.dart';
import '../repositories/checkout_repository.dart';

class CheckDeliveryPin implements UseCase<PinCheckResult, PinCheckRequest> {
  const CheckDeliveryPin(this._repository);

  final CheckoutRepository _repository;

  @override
  Future<Either<Failure, PinCheckResult>> call(PinCheckRequest params) =>
      _repository.checkDeliveryPin(params);
}
