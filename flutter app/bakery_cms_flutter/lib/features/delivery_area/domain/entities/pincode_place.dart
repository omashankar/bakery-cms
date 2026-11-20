import 'package:equatable/equatable.dart';

/// Where a six-digit PIN is, from India Post's directory: the website's
/// `PincodePlace` (`types/delivery.ts`).
class PincodePlace extends Equatable {
  const PincodePlace({
    required this.pincode,
    required this.state,
    this.districts = const [],
    this.areas = const [],
  });

  final String pincode;
  final String state;

  /// Usually one; a PIN on a district line lists each. The first is the one
  /// an address form fills in as the city, as the website's checkout does.
  final List<String> districts;

  /// "Talwandi", "Vigyan Nagar" …: at most five, towns first. For showing.
  final List<String> areas;

  /// What an address form puts in an empty City box ('' when none).
  String get city => districts.isEmpty ? '' : districts.first.trim();

  @override
  List<Object?> get props => [pincode, state, districts, areas];
}
