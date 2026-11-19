import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/checkout_repository.dart';

/// Whether the shop can take an online payment now: true, false, or null for
/// "it did not say". Only an explicit false hides "Pay online", as on the
/// website (checkout-page.tsx, `checkGateway`).
class CheckOnlinePayment implements UseCase<bool?, NoParams> {
  const CheckOnlinePayment(this._repository);

  final CheckoutRepository _repository;

  @override
  Future<Either<Failure, bool?>> call(NoParams params) => _repository.onlinePaymentAvailable();
}
