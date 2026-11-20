import '../../domain/entities/payment_request.dart';
import '../../domain/entities/payment_result.dart';

/// The device's payment sheet. Throws `PaymentException`.
abstract interface class PaymentDataSource {
  bool get isSupported;

  Future<PaymentResult> pay(PaymentRequest request);
}
