import '../models/pincode_place_model.dart';

abstract interface class PincodeDirectoryRemoteDataSource {
  /// The place at [pincode], or null when India Post lists no such PIN.
  /// Throws when the directory gave no answer about it.
  Future<PincodePlaceModel?> place(String pincode);
}
