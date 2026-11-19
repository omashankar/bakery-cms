import 'package:bakery_cms_flutter/features/delivery_area/data/models/delivery_area_model.dart';
import 'package:bakery_cms_flutter/features/delivery_area/data/models/pincode_check_request_model.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_area.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_verdict.dart';
import 'package:flutter_test/flutter_test.dart';

/// The shop's pincode answers, as the live server sent them on 2026-11-18
/// (`POST /api/checkout/delivery-pin {"pincode": ...}`), plus the pincode
/// the app asked about.
void main() {
  DeliveryArea read(Map<String, dynamic> json, String pincode) =>
      DeliveryAreaModel.fromJson({...json, 'pincode': pincode}).toEntity();

  test('324002: delivered, with the charge, days, threshold and the place', () {
    final area = read({
      'required': true,
      'status': 'eligible',
      'city': 'Kota',
      'state': 'Rajasthan',
      'charge': 99,
      'minDeliveryDays': 0,
      'freeDeliveryThreshold': 999,
      'priceMayVary': true,
      'at': {'lat': 25.21, 'lng': 75.89},
    }, '324002');
    expect(
      area,
      const DeliveryArea(
        pincode: '324002',
        verdict: DeliveryVerdict.eligible,
        city: 'Kota',
        state: 'Rajasthan',
        charge: 99,
        minDeliveryDays: 0,
        freeDeliveryThreshold: 999,
        priceMayVary: true,
      ),
    );
    expect(area.delivers, isTrue);
  });

  test('400001: outside, with only the place', () {
    final area = read({
      'required': true,
      'status': 'outside',
      'city': 'Mumbai',
      'state': 'Maharashtra',
    }, '400001');
    expect(area.verdict, DeliveryVerdict.outside);
    expect(area.city, 'Mumbai');
    expect(area.charge, isNull);
    expect(area.delivers, isFalse);
  });

  test('a PIN India Post does not know reads as unknown', () {
    final area = read({'required': true, 'status': 'unknown'}, '325600');
    expect(area.verdict, DeliveryVerdict.unknown);
    expect(area.city, '');
  });

  test('parts of a PIN read as partly; refused or a new word reads as a no, never a yes', () {
    expect(read({'status': 'partly'}, '324001').verdict, DeliveryVerdict.partly);
    expect(read({'status': 'refused'}, '324001').verdict, DeliveryVerdict.outside);
    expect(read({'status': 'maybe'}, '324001').verdict, DeliveryVerdict.outside);
    expect(read({}, '324001').verdict, DeliveryVerdict.outside);
  });

  test('a shop without delivery areas: yes, at its flat fee', () {
    final area = read({'required': false, 'status': 'eligible', 'charge': 49}, '110001');
    expect(area.delivers, isTrue);
    expect(area.zonesRequired, isFalse);
    expect(area.charge, 49);
  });

  test('odd values do not fail the answer', () {
    final area = read({
      'status': 'eligible',
      'charge': '99',
      'minDeliveryDays': null,
      'city': 7,
      'priceMayVary': 'yes',
    }, '324002');
    expect(area.charge, 99);
    expect(area.minDeliveryDays, isNull);
    expect(area.city, '');
    expect(area.priceMayVary, isFalse);
  });

  test('kept on the device and read back unchanged', () {
    const area = DeliveryArea(
      pincode: '324002',
      verdict: DeliveryVerdict.partly,
      city: 'Kota',
      state: 'Rajasthan',
      charge: 99,
      minDeliveryDays: 1,
      freeDeliveryThreshold: 999,
      priceMayVary: true,
      zonesRequired: false,
    );
    final json = DeliveryAreaModel.fromEntity(area).toJson();
    expect(DeliveryAreaModel.fromJson(json).toEntity(), area);
  });

  test('the request carries the PIN code alone, so the server answers by PIN', () {
    expect(const PincodeCheckRequestModel('324002').toJson(), {'pincode': '324002'});
  });
}
