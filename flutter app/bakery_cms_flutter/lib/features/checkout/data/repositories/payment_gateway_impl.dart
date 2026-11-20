import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../domain/entities/payment_request.dart';
import '../../domain/entities/payment_result.dart';
import '../../domain/failures/payment_cancelled_failure.dart';
import '../../domain/failures/payment_failed_failure.dart';
import '../../domain/repositories/payment_gateway.dart';
import '../datasources/payment_data_source.dart';
import '../exceptions/payment_exception.dart';

class PaymentGatewayImpl implements PaymentGateway {
  const PaymentGatewayImpl(this._dataSource);

  final PaymentDataSource _dataSource;

  @override
  bool get isSupported => _dataSource.isSupported;

  @override
  Future<Either<Failure, PaymentResult>> pay(PaymentRequest request) async {
    try {
      return Right(await _dataSource.pay(request));
    } on PaymentException catch (e) {
      return Left(e.cancelled ? const PaymentCancelledFailure() : const PaymentFailedFailure());
    } catch (_) {
      // The plugin itself broke (missing activity, bad options): never charged.
      return const Left(PaymentFailedFailure());
    }
  }
}
