import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/error/failure.dart';

/// The money was captured but the order was not confirmed.
///
/// Checkout locks after this: the customer must not pay again.
/// - [refused] false: the answer never came (network, or the shop failed).
///   The shop's Razorpay webhook builds the order from the draft on its own.
/// - [refused] true: the shop said no after the payment. The customer needs
///   the [paymentId] to sort it out with the shop.
class PaidButUnconfirmedFailure extends Failure {
  PaidButUnconfirmedFailure({required this.paymentId, this.refused = false})
    : super(
        refused
            ? CheckoutStrings.paidButRefused(paymentId)
            : CheckoutStrings.paidButUnconfirmedFor(paymentId),
      );

  final String paymentId;
  final bool refused;

  @override
  List<Object?> get props => [message, paymentId, refused];
}
