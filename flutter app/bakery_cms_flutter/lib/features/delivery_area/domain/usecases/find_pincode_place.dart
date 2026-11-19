import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/pincode_place.dart';
import '../repositories/pincode_directory_repository.dart';

/// "Where is 324001?" Takes the six-digit PIN; null when India Post lists no
/// such PIN. Read-only: what an address form does with it is its own rule.
class FindPincodePlace implements UseCase<PincodePlace?, String> {
  const FindPincodePlace(this._repository);

  final PincodeDirectoryRepository _repository;

  @override
  Future<Either<Failure, PincodePlace?>> call(String pincode) => _repository.place(pincode.trim());
}
