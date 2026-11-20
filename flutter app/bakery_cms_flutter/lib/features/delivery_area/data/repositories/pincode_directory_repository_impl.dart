import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/pincode_place.dart';
import '../../domain/repositories/pincode_directory_repository.dart';
import '../datasources/pincode_directory_remote_data_source.dart';

/// Remembers every answer for as long as the app runs, as the website keeps
/// them for the visit: where a PIN is does not change while the app is open.
/// A failed read is not kept, so the next keystroke asks again.
class PincodeDirectoryRepositoryImpl implements PincodeDirectoryRepository {
  PincodeDirectoryRepositoryImpl(this._remote);

  final PincodeDirectoryRemoteDataSource _remote;
  final Map<String, PincodePlace?> _known = {};

  @override
  Future<Either<Failure, PincodePlace?>> place(String pincode) async {
    if (_known.containsKey(pincode)) return Right(_known[pincode]);
    final result = await guard(() async => (await _remote.place(pincode))?.toEntity());
    result.match((_) {}, (place) => _known[pincode] = place);
    return result;
  }
}
