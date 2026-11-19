/// The shop's wall clock (General → Timezone), not the phone's.
///
/// Delivery dates, the same-day cutoff and "today's windows" are decided on
/// it, because the server decides them on it (`shopClockNow` in
/// `features/orders/lib/delivery-date.ts`). On the phone's clock, a customer
/// abroad, or with a wrong clock, was offered a window already over in the
/// shop's city, and the server, which gives a day of slack, accepted it.
class ShopClock {
  const ShopClock(this.timezone, {DateTime Function() instant = DateTime.now}) : _instant = instant;

  /// IANA zone, e.g. "Asia/Kolkata".
  final String timezone;

  /// The current moment (any zone); injectable so tests can pin it.
  final DateTime Function() _instant;

  /// Zones with a fixed offset and no daylight saving. India is the shop's
  /// market (Razorpay charges INR only); another zone falls back to the
  /// phone's clock rather than guessing.
  static const Map<String, Duration> _fixedOffsets = {
    'Asia/Kolkata': Duration(hours: 5, minutes: 30),
    'Asia/Calcutta': Duration(hours: 5, minutes: 30),
  };

  /// Now on the shop's clock, as a local [DateTime] whose fields (year to
  /// second) read as the shop's wall clock. [DeliverySchedule] compares only
  /// fields, so it never mixes this with a UTC instant.
  DateTime now() {
    final offset = _fixedOffsets[timezone];
    final instant = _instant();
    if (offset == null) return instant.toLocal();
    final wall = instant.toUtc().add(offset);
    return DateTime(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second);
  }
}
