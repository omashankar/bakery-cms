import 'package:bakery_cms_flutter/core/utils/money_formatter.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('a whole amount carried in floating point prints without paise', () {
    expect(MoneyFormatter.format(999 + 49 + 0.0000000000002), '₹1,048');
    expect(MoneyFormatter.format(0.1 + 0.2 + 2.7), '₹3');
  });

  test('real paise still print', () {
    expect(MoneyFormatter.format(152.35), '₹152.35');
  });

  test('Indian grouping', () {
    expect(MoneyFormatter.format(125000), '₹1,25,000');
  });
}
