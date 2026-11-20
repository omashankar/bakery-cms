import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/payment_request.dart';
import '../entities/payment_result.dart';

/// Takes an online payment on the device.
abstract interface class PaymentGateway {
  /// False where the gateway has no SDK (web, desktop).
  bool get isSupported;

  Future<Either<Failure, PaymentResult>> pay(PaymentRequest request);
}
