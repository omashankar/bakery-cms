import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/error/failure.dart';
import '../entities/quote.dart';
import 'price_change_reason.dart';

/// The final quote differs from the total the customer saw, so nothing was
/// paid or placed. [quote] is the new price, to show and confirm.
///
/// The running total is priced from the PIN alone; the final one from the
/// full address and map pin, with the coupon checked again. Charging the
/// difference without saying so is what this stops.
class PriceChangedFailure extends Failure {
  PriceChangedFailure({required this.quote, required this.reason})
    : super(switch (reason) {
        PriceChangeReason.couponRejected => CheckoutStrings.priceChangedCoupon,
        PriceChangeReason.totalChanged => CheckoutStrings.priceChangedTotal,
        PriceChangeReason.notShown => CheckoutStrings.priceNotShown,
      });

  final Quote quote;
  final PriceChangeReason reason;

  @override
  List<Object?> get props => [message, quote, reason];
}
