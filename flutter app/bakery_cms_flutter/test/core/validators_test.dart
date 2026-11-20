import 'package:bakery_cms_flutter/core/utils/validators.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('phone', () {
    test('accepts the ways Indian mobiles are written', () {
      for (final phone in [
        '9876543210',
        '98765 43210',
        '07627014106', // a saved account number, with its trunk 0
        '919876543210',
        '+91 98765-43210',
      ]) {
        expect(Validators.phone(phone), isNull, reason: phone);
      }
    });

    test('refuses what is not a mobile', () {
      for (final phone in ['12345', '5876543210', '098765432', '+1 9876543210', '']) {
        expect(Validators.phone(phone), isNotNull, reason: phone);
      }
    });
  });

  test('pincode', () {
    expect(Validators.pincode('324001'), isNull);
    expect(Validators.pincode('024001'), isNotNull);
    expect(Validators.pincode('32400'), isNotNull);
  });

  test('otp', () {
    expect(Validators.otp('123456'), isNull);
    expect(Validators.otp('12345a'), isNotNull);
  });

  test('email', () {
    expect(Validators.email('a@b.co'), isNull);
    expect(Validators.email('a@b'), isNotNull);
  });
}
