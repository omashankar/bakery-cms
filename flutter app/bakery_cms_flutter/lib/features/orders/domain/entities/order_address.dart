import 'package:equatable/equatable.dart';

class OrderAddress extends Equatable {
  const OrderAddress({
    required this.fullName,
    required this.email,
    required this.phone,
    required this.addressLine1,
    required this.city,
    required this.state,
    required this.pincode,
    this.addressLine2,
    this.landmark,
    this.label,
  });

  final String fullName;
  final String email;
  final String phone;
  final String addressLine1;
  final String? addressLine2;
  final String? landmark;
  final String city;
  final String state;
  final String pincode;

  /// Home / Office / Other.
  final String? label;

  /// "12 Park Road, Near the temple, Kota, Rajasthan 324001"
  String get singleLine => [
    addressLine1,
    addressLine2,
    landmark,
    city,
    '$state $pincode'.trim(),
  ].whereType<String>().where((part) => part.trim().isNotEmpty).join(', ');

  @override
  List<Object?> get props => [
    fullName,
    email,
    phone,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    pincode,
    label,
  ];
}
