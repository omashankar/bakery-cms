import 'package:bakery_cms_flutter/features/addresses/data/models/saved_address_model.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/address_label.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final fromWebsite = <String, dynamic>{
    'id': 'web-1',
    'label': "Mom's place",
    'isDefault': true,
    'createdAt': '2026-11-01T10:00:00.000Z',
    'updatedAt': '2026-11-02T10:00:00.000Z',
    'fullName': 'Asha Verma',
    'email': 'asha@example.com',
    'phone': '9876543210',
    'addressLine1': '12 Park Road',
    'addressLine2': 'Talwandi',
    'city': 'Kota',
    'state': 'Rajasthan',
    'pincode': '324001',
    'country': 'India',
    'altPhone': '9123456780',
    'addressLabel': 'Other',
  };

  test('reads what the website saved', () {
    final address = SavedAddressModel.fromJson(fromWebsite).toEntity();
    expect(address.id, 'web-1');
    expect(address.label, "Mom's place");
    expect(address.kind, AddressLabel.other);
    expect(address.isDefault, isTrue);
    expect(address.updatedAt, DateTime.utc(2026, 11, 2, 10));
    expect(address.landmark, '', reason: 'a missing optional field reads as empty');
  });

  test('writes back every field it read, so a save from the app drops nothing', () {
    final json = SavedAddressModel.fromEntity(SavedAddressModel.fromJson(fromWebsite).toEntity())
        .toJson();
    expect(json, fromWebsite);
  });

  test('an unreadable value falls back instead of failing the whole book', () {
    final address = SavedAddressModel.fromJson(const {'id': 7, 'isDefault': 'yes'}).toEntity();
    expect(address.id, '');
    expect(address.isDefault, isFalse);
    expect(address.createdAt, isNull);
    expect(address.kind, AddressLabel.home);
  });
}
