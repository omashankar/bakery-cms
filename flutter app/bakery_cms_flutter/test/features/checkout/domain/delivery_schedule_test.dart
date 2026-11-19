import 'package:bakery_cms_flutter/features/checkout/domain/entities/delivery_schedule.dart';
import 'package:flutter_test/flutter_test.dart';

import '../checkout_fixtures.dart';

void main() {
  group('bookableDates', () {
    test('starts today before the cutoff and spans 14 days', () {
      final schedule = DeliverySchedule(now: morning, leadDays: 0, sameDayCutoff: '14:00');
      final dates = schedule.bookableDates;
      expect(dates.first, DateTime(2026, 11, 16));
      expect(dates, hasLength(14));
      expect(dates.last, DateTime(2026, 11, 29));
    });

    test('skips today once the same-day cutoff has passed', () {
      final schedule = DeliverySchedule(
        now: DateTime(2026, 11, 16, 14),
        leadDays: 0,
        sameDayCutoff: '14:00',
      );
      expect(schedule.bookableDates.first, DateTime(2026, 11, 17));
    });

    test('an empty cutoff never closes today', () {
      final schedule = DeliverySchedule(
        now: DateTime(2026, 11, 16, 23, 30),
        leadDays: 0,
        sameDayCutoff: '',
      );
      expect(schedule.bookableDates.first, DateTime(2026, 11, 16));
    });

    test('honours the lead time, and the cutoff no longer matters', () {
      final schedule = DeliverySchedule(
        now: DateTime(2026, 11, 16, 20),
        leadDays: 2,
        sameDayCutoff: '14:00',
      );
      expect(schedule.bookableDates.first, DateTime(2026, 11, 18));
    });

    test('crosses a month end', () {
      final schedule = DeliverySchedule(
        now: DateTime(2026, 11, 30, 9),
        leadDays: 1,
        sameDayCutoff: '14:00',
      );
      expect(schedule.bookableDates.first, DateTime(2026, 12, 1));
    });
  });

  group('windowsFor', () {
    final schedule = DeliverySchedule(
      now: DateTime(2026, 11, 16, 12, 30),
      leadDays: 0,
      sameDayCutoff: '14:00',
    );

    test('drops today\'s windows that have already started', () {
      expect(
        schedule.windowsFor(date: DateTime(2026, 11, 16), tier: standard),
        ['6:00 PM – 8:00 PM'],
      );
    });

    test('offers every window on a later day', () {
      expect(
        schedule.windowsFor(date: DateTime(2026, 11, 17), tier: standard),
        standard.windows,
      );
    });

    test('falls back to the shop\'s plain slots without a tier', () {
      expect(
        schedule.windowsFor(date: DateTime(2026, 11, 17), fallbackSlots: const ['9:00 AM – 1:00 PM']),
        ['9:00 AM – 1:00 PM'],
      );
    });

    test('keeps the midnight window through the evening', () {
      expect(schedule.windowsFor(date: DateTime(2026, 11, 16), tier: midnight), midnight.windows);
    });
  });

  group('startMinutes', () {
    test('reads 12-hour clocks with an en dash range', () {
      expect(DeliverySchedule.startMinutes('10:00 AM – 12:00 PM'), 600);
      expect(DeliverySchedule.startMinutes('12:00 PM – 2:00 PM'), 720);
      expect(DeliverySchedule.startMinutes('11:00 PM – 12:00 AM'), 1380);
      expect(DeliverySchedule.startMinutes('12:30 am - 1:00 am'), 30);
    });

    test('reads a 24-hour clock and gives up on text', () {
      expect(DeliverySchedule.startMinutes('18:15 - 19:00'), 1095);
      expect(DeliverySchedule.startMinutes('Any time'), isNull);
    });
  });
}
