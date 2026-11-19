import 'package:intl/intl.dart';

abstract final class DateFormatter {
  static final DateFormat _api = DateFormat('yyyy-MM-dd');
  static final DateFormat _display = DateFormat('EEE, d MMM');
  static final DateFormat _short = DateFormat('d MMM');
  static final DateFormat _displayWithYear = DateFormat('d MMM yyyy, h:mm a');

  /// The calendar date the shop's API expects (`YYYY-MM-DD`).
  static String toApiDate(DateTime date) => _api.format(date);

  static DateTime? fromApiDate(String value) => DateTime.tryParse(value);

  /// "22 Nov", for a date inside a sentence ("Earliest delivery: 22 Nov").
  static String shortDay(DateTime date) => _short.format(date);

  /// "Mon, 16 Nov" for delivery dates.
  static String day(DateTime date) => _display.format(date);

  /// "16 Nov 2026, 4:30 PM" for when an order was placed.
  static String timestamp(String iso) {
    final parsed = DateTime.tryParse(iso);
    return parsed == null ? iso : _displayWithYear.format(parsed.toLocal());
  }
}
