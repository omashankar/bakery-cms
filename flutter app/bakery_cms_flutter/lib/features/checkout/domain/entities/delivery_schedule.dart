import '../../../store/domain/entities/delivery_tier.dart';

/// Which days and windows a customer can book, by the shop's rules.
///
/// Mirrors the server's checks (`features/orders/lib/delivery-date.ts`) so
/// the pickers only offer what the quote will accept:
/// - the lead time: the first day is `today + leadDays`;
/// - the same-day cutoff: once past it, today is not offered;
/// - a window today is dropped once it has started.
class DeliverySchedule {
  const DeliverySchedule({
    required this.now,
    required this.leadDays,
    required this.sameDayCutoff,
    this.horizonDays = 14,
  });

  final DateTime now;
  final int leadDays;

  /// "14:00", or empty for no cutoff.
  final String sameDayCutoff;
  final int horizonDays;

  static final RegExp _hhmm = RegExp(r'^(\d{1,2}):(\d{2})$');
  static final RegExp _clock = RegExp(r'(\d{1,2}):(\d{2})\s*(am|pm)?', caseSensitive: false);

  DateTime get today => DateTime(now.year, now.month, now.day);

  int get _minutesNow => now.hour * 60 + now.minute;

  bool get isPastCutoff {
    final match = _hhmm.firstMatch(sameDayCutoff.trim());
    if (match == null) return false;
    final cutoff = int.parse(match.group(1)!) * 60 + int.parse(match.group(2)!);
    return _minutesNow >= cutoff;
  }

  /// [horizonDays] consecutive days, starting at the first bookable one.
  List<DateTime> get bookableDates {
    var first = DateTime(today.year, today.month, today.day + (leadDays < 0 ? 0 : leadDays));
    if (isSameDay(first, today) && isPastCutoff) {
      first = DateTime(first.year, first.month, first.day + 1);
    }
    return [for (var i = 0; i < horizonDays; i++) DateTime(first.year, first.month, first.day + i)];
  }

  /// The [tier]'s windows (or the shop's plain [fallbackSlots]) on [date].
  List<String> windowsFor({
    required DateTime date,
    DeliveryTier? tier,
    List<String> fallbackSlots = const [],
  }) {
    final windows = tier?.windows ?? fallbackSlots;
    if (!isSameDay(date, today)) return windows;
    return windows.where((window) {
      final start = startMinutes(window);
      return start == null || start > _minutesNow;
    }).toList();
  }

  /// Minutes into the day a window like "10:00 AM – 12:00 PM" opens.
  static int? startMinutes(String window) {
    final match = _clock.firstMatch(window);
    if (match == null) return null;
    final hour = int.parse(match.group(1)!);
    final minute = int.parse(match.group(2)!);
    final meridiem = match.group(3)?.toLowerCase();
    if (meridiem == null) return hour * 60 + minute;
    return ((hour % 12) + (meridiem == 'pm' ? 12 : 0)) * 60 + minute;
  }

  static bool isSameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}
