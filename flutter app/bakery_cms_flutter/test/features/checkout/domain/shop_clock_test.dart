import 'package:bakery_cms_flutter/features/checkout/domain/services/shop_clock.dart';
import 'package:flutter_test/flutter_test.dart';

/// Review finding: dates and windows were decided on the PHONE's clock. The
/// server decides them on the shop's (Asia/Kolkata), so a phone abroad was
/// offered a window already over in Kota.
void main() {
  // 20:00 UTC on 16 Nov is 01:30 on 17 Nov in India.
  DateTime lateEveningUtc() => DateTime.utc(2026, 11, 16, 20);

  test('Asia/Kolkata reads the instant on Indian time', () {
    final now = ShopClock('Asia/Kolkata', instant: lateEveningUtc).now();
    expect(now, DateTime(2026, 11, 17, 1, 30));
  });

  test('the old name Asia/Calcutta is the same clock', () {
    final now = ShopClock('Asia/Calcutta', instant: lateEveningUtc).now();
    expect(now, DateTime(2026, 11, 17, 1, 30));
  });

  test('the result is a local wall-clock reading, never a UTC instant', () {
    final now = ShopClock('Asia/Kolkata', instant: lateEveningUtc).now();
    expect(now.isUtc, isFalse, reason: 'the schedule builds local dates and compares fields');
  });

  test('an unknown zone falls back to the phone clock instead of guessing', () {
    final now = ShopClock('Europe/London', instant: lateEveningUtc).now();
    expect(now, lateEveningUtc().toLocal());
  });
}
