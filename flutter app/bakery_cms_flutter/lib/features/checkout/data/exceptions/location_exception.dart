import '../../../../core/error/app_exception.dart';
import 'location_problem.dart';

class LocationException extends AppException {
  const LocationException(this.problem);

  final LocationProblem problem;
}
