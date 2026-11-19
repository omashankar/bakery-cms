import '../../../../core/error/app_exception.dart';

class PaymentException extends AppException {
  const PaymentException({this.cancelled = false});

  /// The customer closed the sheet rather than the payment failing.
  final bool cancelled;
}
