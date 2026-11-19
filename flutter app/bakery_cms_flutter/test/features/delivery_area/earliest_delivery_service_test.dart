import 'package:bakery_cms_flutter/features/checkout/domain/services/shop_clock.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/services/earliest_delivery_service.dart';
import 'package:flutter_test/flutter_test.dart';

/// "Earliest delivery" on the home page: the first day checkout's date list
/// would offer, on the shop's clock.
void main() {
  /// A service whose clock reads [utc] in [zone].
  EarliestDeliveryService at(DateTime utc, {String zone = 'Asia/Kolkata'}) =>
      EarliestDeliveryService(ShopClock(zone, instant: () => utc));

  // 03:30 UTC = 09:00 in Kota, Monday 16 November 2026.
  final kotaMorning = DateTime.utc(2026, 11, 16, 3, 30);
  // 09:30 UTC = 15:00 in Kota, past a 14:00 cutoff.
  final kotaAfternoon = DateTime.utc(2026, 11, 16, 9, 30);

  test('before the same-day cutoff, with no lead time: today', () {
    final earliest = at(kotaMorning).earliest(leadDays: 0, sameDayCutoff: '14:00');
    expect(earliest.isToday, isTrue);
    expect(earliest.date, DateTime(2026, 11, 16));
  });

  test('once the cutoff has passed: tomorrow', () {
    final earliest = at(kotaAfternoon).earliest(leadDays: 0, sameDayCutoff: '14:00');
    expect(earliest.isTomorrow, isTrue);
    expect(earliest.date, DateTime(2026, 11, 17));
  });

  test('exactly at the cutoff counts as past it, as checkout does', () {
    final atCutoff = DateTime.utc(2026, 11, 16, 8, 30); // 14:00 IST
    expect(at(atCutoff).earliest(leadDays: 0, sameDayCutoff: '14:00').daysFromToday, 1);
  });

  test('no cutoff set: today all day', () {
    final lateEvening = DateTime.utc(2026, 11, 16, 17, 0); // 22:30 IST
    expect(at(lateEvening).earliest(leadDays: 0, sameDayCutoff: '').isToday, isTrue);
  });

  test('the shop lead time moves the first day out, and the cutoff no longer matters', () {
    final earliest = at(kotaAfternoon).earliest(leadDays: 3, sameDayCutoff: '14:00');
    expect(earliest.daysFromToday, 3);
    expect(earliest.date, DateTime(2026, 11, 19));
  });

  test("the area's own preparation days win when longer than the shop's", () {
    final earliest = at(
      kotaMorning,
    ).earliest(leadDays: 1, sameDayCutoff: '14:00', minDeliveryDays: 2);
    expect(earliest.date, DateTime(2026, 11, 18));
  });

  test("the shop's lead time wins when longer than the area's", () {
    final earliest = at(
      kotaMorning,
    ).earliest(leadDays: 2, sameDayCutoff: '14:00', minDeliveryDays: 1);
    expect(earliest.daysFromToday, 2);
  });

  test("decided on the shop's clock: 20:00 UTC is already tomorrow in Kota", () {
    // 20:00 UTC on the 16th = 01:30 IST on the 17th: "today" is the 17th.
    final earliest = at(
      DateTime.utc(2026, 11, 16, 20, 0),
    ).earliest(leadDays: 0, sameDayCutoff: '14:00');
    expect(earliest.isToday, isTrue);
    expect(earliest.date, DateTime(2026, 11, 17));
  });

  test('a month end rolls over to the next month', () {
    final lastDay = DateTime.utc(2026, 11, 30, 10, 0); // 15:30 IST, past cutoff
    final earliest = at(lastDay).earliest(leadDays: 0, sameDayCutoff: '14:00');
    expect(earliest.date, DateTime(2026, 12, 1));
    expect(earliest.isTomorrow, isTrue);
  });
}
