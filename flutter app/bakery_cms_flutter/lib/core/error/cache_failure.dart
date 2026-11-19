import '../constants/app_strings.dart';
import 'failure.dart';

class CacheFailure extends Failure {
  const CacheFailure() : super(AppStrings.errorCache);
}
