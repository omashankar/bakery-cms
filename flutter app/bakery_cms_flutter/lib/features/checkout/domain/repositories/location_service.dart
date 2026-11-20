import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/geo_point.dart';

abstract interface class LocationService {
  /// With [askPermission] false, a customer who has not allowed location yet
  /// gets a failure instead of the system prompt.
  Future<Either<Failure, GeoPoint>> currentLocation({required bool askPermission});
}
