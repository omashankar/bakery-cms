import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/error/failure.dart';

/// The gateway refused or could not take the payment.
class PaymentFailedFailure extends Failure {
  const PaymentFailedFailure() : super(CheckoutStrings.paymentFailed);
}
