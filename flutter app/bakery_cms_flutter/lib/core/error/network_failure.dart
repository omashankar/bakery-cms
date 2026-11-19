import '../constants/app_strings.dart';
import 'failure.dart';

class NetworkFailure extends Failure {
  const NetworkFailure({bool isTimeout = false})
    : super(isTimeout ? AppStrings.errorTimeout : AppStrings.errorNetwork);
}
