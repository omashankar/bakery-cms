import 'package:equatable/equatable.dart';

/// One row of the shop's opening hours, as the admin typed it
/// ("Monday - Sunday", "9:00 AM - 11:00 PM").
class OpeningHours extends Equatable {
  const OpeningHours({required this.day, required this.hours});

  final String day;
  final String hours;

  @override
  List<Object?> get props => [day, hours];
}
