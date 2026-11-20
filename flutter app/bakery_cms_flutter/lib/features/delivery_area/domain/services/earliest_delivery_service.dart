import 'dart:math';

import '../../../checkout/domain/entities/delivery_schedule.dart';
import '../../../checkout/domain/services/shop_clock.dart';
import '../entities/earliest_delivery.dart';

/// The first day the shop can deliver: the rule checkout's date list uses
/// (the first of [DeliverySchedule.bookableDates]), so the home page never
/// promises a day the checkout will not offer.
///
/// - the shop's lead time, or the area's own preparation days if longer;
/// - once the same-day cutoff has passed, today is not offered;
/// - all on the shop's clock ([ShopClock]), not the phone's.
class EarliestDeliveryService {
  const EarliestDeliveryService(this._clock);

  final ShopClock _clock;

  EarliestDelivery earliest({
    required int leadDays,
    required String sameDayCutoff,
    int? minDeliveryDays,
  }) {
    final schedule = DeliverySchedule(
      now: _clock.now(),
      leadDays: max(leadDays, minDeliveryDays ?? 0),
      sameDayCutoff: sameDayCutoff,
      horizonDays: 1,
    );
    final date = schedule.bookableDates.first;
    return EarliestDelivery(date: date, daysFromToday: _daysBetween(schedule.today, date));
  }

  /// Calendar days, counted in UTC so a daylight-saving change on the
  /// phone's clock never makes a day 23 hours long.
  static int _daysBetween(DateTime from, DateTime to) => DateTime.utc(
    to.year,
    to.month,
    to.day,
  ).difference(DateTime.utc(from.year, from.month, from.day)).inDays;
}
