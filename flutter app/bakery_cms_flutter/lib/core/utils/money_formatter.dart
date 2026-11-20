import 'package:intl/intl.dart';

/// Formats amounts in the shop's currency (General → Currency).
///
/// Whole rupees print without paise, as the website does.
abstract final class MoneyFormatter {
  static String format(num amount, {String currency = 'INR'}) {
    // To the paisa: 1049.0000000000002 (a sum of doubles) is a whole ₹1,049.
    final whole = (amount * 100).round() % 100 == 0;
    return NumberFormat.simpleCurrency(
      locale: 'en_IN',
      name: currency,
      decimalDigits: whole ? 0 : 2,
    ).format(amount);
  }
}
