import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/photo_upload_repository.dart';

/// The file path in, the shop's URL for it out.
class UploadCakePhoto implements UseCase<String, String> {
  const UploadCakePhoto(this._repository);

  final PhotoUploadRepository _repository;

  @override
  Future<Either<Failure, String>> call(String params) => _repository.uploadCakePhoto(params);
}
