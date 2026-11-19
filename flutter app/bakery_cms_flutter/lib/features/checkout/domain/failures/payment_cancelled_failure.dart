import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/error/failure.dart';

/// The customer closed the payment sheet. Not an error: nothing was charged.
class PaymentCancelledFailure extends Failure {
  const PaymentCancelledFailure() : super(CheckoutStrings.paymentCancelled);
}
