import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/delivery_area.dart';
import '../repositories/delivery_area_repository.dart';

/// Keeps the chosen area on this device for the next launch.
class SaveDeliveryArea implements UseCase<Unit, DeliveryArea> {
  const SaveDeliveryArea(this._repository);

  final DeliveryAreaRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(DeliveryArea area) => _repository.save(area);
}
