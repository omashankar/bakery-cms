import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/pincode_place.dart';

/// India Post's PIN directory, as the shop serves it (`GET /api/pincodes`).
abstract interface class PincodeDirectoryRepository {
  /// The place at a six-digit [pincode]: Right(null) when India Post lists
  /// no such PIN, a failure when the directory could not be asked. A failure
  /// is "not known", never "not real".
  Future<Either<Failure, PincodePlace?>> place(String pincode);
}
