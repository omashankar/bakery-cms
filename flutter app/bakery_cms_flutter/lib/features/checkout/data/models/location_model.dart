import 'package:json_annotation/json_annotation.dart';

import '../../domain/entities/geo_point.dart';

part 'location_model.g.dart';

@JsonSerializable(createFactory: false)
class LocationModel {
  const LocationModel({required this.lat, required this.lng});

  factory LocationModel.fromEntity(GeoPoint point) => LocationModel(lat: point.lat, lng: point.lng);

  final double lat;
  final double lng;

  Map<String, dynamic> toJson() => _$LocationModelToJson(this);
}
