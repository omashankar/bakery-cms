import '../constants/app_strings.dart';
import 'failure.dart';

class UnauthorizedFailure extends Failure {
  const UnauthorizedFailure() : super(AppStrings.errorUnauthorized);
}
