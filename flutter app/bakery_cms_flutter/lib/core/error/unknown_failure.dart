import '../constants/app_strings.dart';
import 'failure.dart';

class UnknownFailure extends Failure {
  const UnknownFailure([String? message]) : super(message ?? AppStrings.errorUnknown);
}
