import 'package:fpdart/fpdart.dart';

import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/error/failure.dart';
import '../../domain/entities/geo_point.dart';
import '../../domain/failures/location_failure.dart';
import '../../domain/repositories/location_service.dart';
import '../datasources/location_data_source.dart';
import '../exceptions/location_exception.dart';
import '../exceptions/location_problem.dart';

class LocationServiceImpl implements LocationService {
  const LocationServiceImpl(this._dataSource);

  final LocationDataSource _dataSource;

  @override
  Future<Either<Failure, GeoPoint>> currentLocation({required bool askPermission}) async {
    try {
      return Right(await _dataSource.current(askPermission: askPermission));
    } on LocationException catch (e) {
      return Left(LocationFailure(_messageFor(e.problem)));
    } catch (_) {
      return const Left(LocationFailure(CheckoutStrings.locationUnavailable));
    }
  }

  static String _messageFor(LocationProblem problem) => switch (problem) {
    LocationProblem.serviceDisabled => CheckoutStrings.locationServiceOff,
    LocationProblem.denied => CheckoutStrings.locationDenied,
    LocationProblem.deniedForever => CheckoutStrings.locationDeniedForever,
    LocationProblem.unavailable => CheckoutStrings.locationUnavailable,
  };
}
