import 'package:geolocator/geolocator.dart';

import '../../domain/entities/geo_point.dart';
import '../exceptions/location_exception.dart';
import '../exceptions/location_problem.dart';
import 'location_data_source.dart';

class GeolocatorLocationDataSource implements LocationDataSource {
  const GeolocatorLocationDataSource();

  static const Duration _timeLimit = Duration(seconds: 15);

  @override
  Future<GeoPoint> current({required bool askPermission}) async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw const LocationException(LocationProblem.serviceDisabled);
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied && askPermission) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) {
      throw const LocationException(LocationProblem.deniedForever);
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.unableToDetermine) {
      throw const LocationException(LocationProblem.denied);
    }

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: _timeLimit,
        ),
      );
      return GeoPoint(lat: position.latitude, lng: position.longitude);
    } catch (_) {
      throw const LocationException(LocationProblem.unavailable);
    }
  }
}
