import '../models/public_settings_model.dart';

abstract interface class StoreRemoteDataSource {
  /// Throws a typed `AppException` on failure.
  Future<PublicSettingsModel> fetchPublicSettings();
}
