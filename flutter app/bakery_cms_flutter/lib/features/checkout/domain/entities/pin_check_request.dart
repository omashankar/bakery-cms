import 'package:equatable/equatable.dart';

import 'geo_point.dart';

class PinCheckRequest extends Equatable {
  const PinCheckRequest({
    required this.location,
    this.pincode = '',
    this.city = '',
    this.state = '',
  });

  final GeoPoint location;
  final String pincode;
  final String city;
  final String state;

  @override
  List<Object?> get props => [location, pincode, city, state];
}
