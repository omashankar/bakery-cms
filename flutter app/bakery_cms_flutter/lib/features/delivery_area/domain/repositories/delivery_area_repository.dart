import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/delivery_area.dart';

abstract interface class DeliveryAreaRepository {
  /// Asks the shop whether it delivers to [pincode]. Saves nothing.
  Future<Either<Failure, DeliveryArea>> check(String pincode);

  /// The area kept on this device, or null when none was chosen.
  Future<Either<Failure, DeliveryArea?>> saved();

  /// Keeps [area] on this device for the next launch.
  Future<Either<Failure, Unit>> save(DeliveryArea area);
}
