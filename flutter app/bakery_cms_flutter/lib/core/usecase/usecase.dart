import 'package:fpdart/fpdart.dart';

import '../error/failure.dart';

/// One business action. Blocs depend on use cases, never on repositories, so
/// each screen's dependencies read as a list of the things it can do.
abstract interface class UseCase<T, Params> {
  Future<Either<Failure, T>> call(Params params);
}
