import '../../../../core/constants/strings/checkout_strings.dart';
import '../../../../core/error/failure.dart';

/// This platform has no payment sheet (web, desktop).
class PaymentUnavailableFailure extends Failure {
  const PaymentUnavailableFailure() : super(CheckoutStrings.paymentUnavailable);
}
