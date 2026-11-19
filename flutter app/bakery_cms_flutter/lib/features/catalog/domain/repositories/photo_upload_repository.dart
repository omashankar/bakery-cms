import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';

abstract interface class PhotoUploadRepository {
  /// Stores the photo for a photo cake and answers the URL the cart line
  /// carries. The shop checks at checkout that it issued that URL.
  Future<Either<Failure, String>> uploadCakePhoto(String filePath);
}
