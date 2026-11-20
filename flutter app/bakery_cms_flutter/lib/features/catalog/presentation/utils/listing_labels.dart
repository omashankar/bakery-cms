import '../../../../core/constants/strings/listing_strings.dart';
import '../../../../core/utils/money_formatter.dart';
import '../../domain/entities/listing_sort.dart';
import '../../domain/entities/price_band.dart';

/// The words for a sort and a price band, in the shop's own currency.
abstract final class ListingLabels {
  static String sort(ListingSort sort) => switch (sort) {
    ListingSort.popularity => ListingStrings.sortPopularity,
    ListingSort.priceLowToHigh => ListingStrings.sortPriceLowToHigh,
    ListingSort.priceHighToLow => ListingStrings.sortPriceHighToLow,
  };

  /// "Under ₹500", "₹500 – ₹1,000", "Above ₹2,000".
  static String priceBand(PriceBand band, String currency) {
    String money(double amount) => MoneyFormatter.format(amount, currency: currency);
    final low = band.min;
    final high = band.max;
    if (low == null && high != null) return '${ListingStrings.under} ${money(high)}';
    if (high == null && low != null) return '${ListingStrings.above} ${money(low)}';
    return '${money(low ?? 0)}${ListingStrings.rangeSeparator}${money(high ?? 0)}';
  }
}
