import 'package:equatable/equatable.dart';

import 'opening_hours.dart';

/// How to reach the shop, as /store/contact shows it. A blank field means the
/// shop does not publish it, and its card is not drawn (the website's rule:
/// a cleared phone must never turn into a demo number).
class ShopContact extends Equatable {
  const ShopContact({
    this.address = '',
    this.phone = '',
    this.email = '',
    this.openingHours = const [],
  });

  final String address;
  final String phone;
  final String email;
  final List<OpeningHours> openingHours;

  bool get isEmpty => address.isEmpty && phone.isEmpty && email.isEmpty && openingHours.isEmpty;

  @override
  List<Object?> get props => [address, phone, email, openingHours];
}
