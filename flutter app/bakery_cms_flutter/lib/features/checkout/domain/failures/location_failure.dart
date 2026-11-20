import '../../../../core/error/failure.dart';

/// The device could not give a location. [message] says why and what to do.
class LocationFailure extends Failure {
  const LocationFailure(super.message);
}
