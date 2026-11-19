import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/geo_point.dart';
import '../repositories/location_service.dart';
import 'get_current_location_params.dart';

class GetCurrentLocation implements UseCase<GeoPoint, GetCurrentLocationParams> {
  const GetCurrentLocation(this._service);

  final LocationService _service;

  @override
  Future<Either<Failure, GeoPoint>> call(GetCurrentLocationParams params) =>
      _service.currentLocation(askPermission: params.askPermission);
}
