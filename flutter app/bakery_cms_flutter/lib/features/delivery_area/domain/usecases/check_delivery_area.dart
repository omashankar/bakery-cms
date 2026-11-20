import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/delivery_area.dart';
import '../repositories/delivery_area_repository.dart';

/// "Do you deliver to 324002?" Takes the six-digit PIN code; saves nothing.
class CheckDeliveryArea implements UseCase<DeliveryArea, String> {
  const CheckDeliveryArea(this._repository);

  final DeliveryAreaRepository _repository;

  @override
  Future<Either<Failure, DeliveryArea>> call(String pincode) => _repository.check(pincode.trim());
}
