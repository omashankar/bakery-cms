import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/delivery_area.dart';
import '../repositories/delivery_area_repository.dart';

/// The area kept on this device. No request.
class LoadDeliveryArea implements UseCase<DeliveryArea?, NoParams> {
  const LoadDeliveryArea(this._repository);

  final DeliveryAreaRepository _repository;

  @override
  Future<Either<Failure, DeliveryArea?>> call(NoParams params) => _repository.saved();
}
