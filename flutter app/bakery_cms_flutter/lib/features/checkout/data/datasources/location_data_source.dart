import '../../domain/entities/geo_point.dart';

/// The device's position. Throws `LocationException`.
abstract interface class LocationDataSource {
  /// [askPermission] false never shows the system prompt.
  Future<GeoPoint> current({required bool askPermission});
}
