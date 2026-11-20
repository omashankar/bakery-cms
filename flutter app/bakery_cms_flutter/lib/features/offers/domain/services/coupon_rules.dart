import '../../../../core/constants/strings/offers_strings.dart';
import '../entities/cart_offer.dart';
import '../entities/coupon.dart';
import '../entities/coupon_check.dart';
import '../entities/offer_cart_line.dart';

/// Formats an amount in the shop's currency ("₹1,049").
typedef MoneyText = String Function(double amount);

/// The website's coupon rules, for what the app SAYS about offers
/// (`coupon-offers.ts`, `features/orders/lib/coupons.ts`). The server applies
/// the same rules again at checkout and its answer is the one charged.
abstract final class CouponRules {
  /// Live: switched on and not past its expiry; an unreadable expiry counts
  /// as passed (`isLiveCoupon` / `hasExpired`). A minimum is NOT a reason to
  /// hide an offer — it is said out loud instead.
  static bool isLive(Coupon coupon, DateTime now) {
    if (!coupon.isActive) return false;
    if (coupon.expiryUnreadable) return false;
    final expires = coupon.expiresAt;
    return expires == null || !expires.isBefore(now);
  }

  /// "20% OFF", "₹500 OFF" or "Special Offer" (`couponDiscountLabel`).
  static String discountLabel(Coupon coupon, MoneyText money) {
    final percent = coupon.percentOff;
    if (percent != null && percent != 0) {
      return '${_number(percent)}${OffersStrings.percentOffSuffix}';
    }
    final flat = coupon.flatOff;
    if (flat != null && flat != 0) return '${money(flat)}${OffersStrings.flatOffSuffix}';
    return OffersStrings.specialOffer;
  }

  /// The product page's "Available offers" lines, in the website's order:
  /// the free-delivery threshold when the shop set one, then each live code
  /// with its minimum said out loud (`product-detail-page.tsx`).
  static List<String> productPageLines({
    required List<Coupon> coupons,
    required double freeDeliveryThreshold,
    required MoneyText money,
    required DateTime now,
  }) {
    return [
      if (freeDeliveryThreshold > 0)
        '${OffersStrings.freeDeliveryOver} ${money(freeDeliveryThreshold)}',
      for (final coupon in coupons)
        if (isLive(coupon, now)) _productPageLine(coupon, money),
    ];
  }

  static String _productPageLine(Coupon coupon, MoneyText money) {
    final line = '${OffersStrings.useCode} ${coupon.code} — ${discountLabel(coupon, money)}';
    final minimum = coupon.minSubtotal;
    return minimum != null && minimum != 0
        ? '$line ${OffersStrings.onOrdersOver} ${money(minimum)}'
        : line;
  }

  /// The money a coupon can touch: every line, or only the lines in its
  /// categories (`couponEligibleSubtotal`).
  static double eligibleSubtotal(Coupon coupon, List<OfferCartLine> lines) {
    final scope = coupon.categoryIds.toSet();
    return lines.fold<double>(
      0,
      (sum, line) => scope.isEmpty || line.categoryIds.any(scope.contains) ? sum + line.total : sum,
    );
  }

  /// What [coupon] does for this basket (`evaluateCoupon`). [lines] null
  /// means only the [subtotal] is known: a coupon kept to some categories
  /// then cannot be judged and is refused, as on the website.
  static CouponCheck check(
    Coupon coupon, {
    required double subtotal,
    List<OfferCartLine>? lines,
    required MoneyText money,
    required DateTime now,
    String currency = 'INR',
  }) {
    if (!isLive(coupon, now)) return const CouponCheck.refused(OffersStrings.cannotApply);
    if (coupon.isScoped && lines == null) {
      return const CouponCheck.refused(OffersStrings.selectedItemsOnly);
    }
    final base = lines == null ? subtotal : eligibleSubtotal(coupon, lines);
    final minimum = coupon.minSubtotal;
    if (minimum != null && minimum != 0 && base < minimum) {
      return CouponCheck.refused(
        '${OffersStrings.minimumOrder} ${money(minimum)} ${OffersStrings.required}',
      );
    }
    var discount = 0.0;
    final percent = coupon.percentOff;
    final flat = coupon.flatOff;
    if (percent != null && percent != 0) {
      discount = roundToCurrency(base * percent / 100, currency);
    } else if (flat != null && flat != 0) {
      discount = flat;
    }
    if (discount > base) discount = base;
    if (discount <= 0) return const CouponCheck.refused(OffersStrings.cannotApply);
    return CouponCheck.applies(discount);
  }

  /// The live offers this basket has not taken yet, each with what it still
  /// needs (`offersForCart`); the applied code is left out — it is the
  /// current state, not an offer.
  static List<CartOffer> forCart(
    List<Coupon> coupons, {
    required double subtotal,
    List<OfferCartLine>? lines,
    String? appliedCode,
    required MoneyText money,
    required DateTime now,
    String currency = 'INR',
  }) {
    final skip = appliedCode?.trim().toUpperCase();
    return [
      for (final coupon in coupons)
        if (isLive(coupon, now) && coupon.code.trim().toUpperCase() != skip)
          _offer(coupon, subtotal, lines, money, now, currency),
    ];
  }

  static CartOffer _offer(
    Coupon coupon,
    double subtotal,
    List<OfferCartLine>? lines,
    MoneyText money,
    DateTime now,
    String currency,
  ) {
    final reach = lines == null ? subtotal : eligibleSubtotal(coupon, lines);
    final short = (coupon.minSubtotal ?? 0) - reach;
    final shortfall = short > 0 ? short : 0.0;
    return CartOffer(
      code: coupon.code,
      label: discountLabel(coupon, money),
      shortfall: shortfall,
      check: shortfall > 0
          ? null
          : check(
              coupon,
              subtotal: subtotal,
              lines: lines,
              money: money,
              now: now,
              currency: currency,
            ),
    );
  }

  /// Whole rupees (and yen, won, dong); cents elsewhere (`roundToCurrency`).
  static double roundToCurrency(double value, String currency) {
    const whole = {'INR', 'JPY', 'KRW', 'VND'};
    if (whole.contains(currency.toUpperCase())) return value.roundToDouble();
    return (value * 100).round() / 100;
  }

  static String _number(double value) =>
      value == value.roundToDouble() ? value.toInt().toString() : value.toString();
}
