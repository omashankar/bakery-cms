import 'package:bakery_cms_flutter/features/addresses/domain/entities/address_book.dart';
import 'package:bakery_cms_flutter/features/addresses/domain/entities/saved_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/address_label.dart';

final DateTime monday = DateTime.utc(2026, 11, 16, 9);

SavedAddress saved(
  String id, {
  bool isDefault = false,
  String line1 = '12 Park Road',
  String pincode = '324001',
  DateTime? updatedAt,
  String fullName = 'Asha Verma',
  String email = 'asha@example.com',
  String phone = '9876543210',
}) =>
    SavedAddress(
      id: id,
      label: 'Home',
      kind: AddressLabel.home,
      isDefault: isDefault,
      createdAt: monday,
      updatedAt: updatedAt ?? monday,
      fullName: fullName,
      email: email,
      phone: phone,
      addressLine1: line1,
      city: 'Kota',
      state: 'Rajasthan',
      pincode: pincode,
    );

/// [count] addresses at different places, the first the default.
AddressBook bookOf(int count) => AddressBook([
      for (var i = 0; i < count; i++)
        saved('a$i', isDefault: i == 0, line1: '$i Park Road', pincode: '3240${(10 + i) % 100}'),
    ]);

/// The ids marked default; the rule is that there is exactly one.
List<String> defaults(AddressBook book) =>
    book.addresses.where((a) => a.isDefault).map((a) => a.id).toList();
