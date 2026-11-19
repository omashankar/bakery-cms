import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/repositories/photo_upload_repository.dart';
import '../datasources/photo_upload_remote_data_source.dart';

class PhotoUploadRepositoryImpl implements PhotoUploadRepository {
  const PhotoUploadRepositoryImpl(this._remote);

  final PhotoUploadRemoteDataSource _remote;

  @override
  Future<Either<Failure, String>> uploadCakePhoto(String filePath) =>
      guard(() => _remote.uploadCakePhoto(filePath));
}
