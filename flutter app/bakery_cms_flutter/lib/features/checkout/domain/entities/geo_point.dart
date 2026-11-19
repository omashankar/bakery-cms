import 'package:equatable/equatable.dart';

/// A map pin: where the customer wants the order delivered.
class GeoPoint extends Equatable {
  const GeoPoint({required this.lat, required this.lng});

  final double lat;
  final double lng;

  @override
  List<Object?> get props => [lat, lng];
}
