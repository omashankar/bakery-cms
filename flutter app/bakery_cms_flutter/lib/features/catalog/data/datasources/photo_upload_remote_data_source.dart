abstract interface class PhotoUploadRemoteDataSource {
  /// The URL the shop stored the photo at.
  Future<String> uploadCakePhoto(String filePath);
}
