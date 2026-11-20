import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/checkout_catalog.dart';
import '../repositories/checkout_repository.dart';

/// The live catalogue as checkout reads it, fresh on every checkout.
class GetCheckoutCatalog implements UseCase<CheckoutCatalog, NoParams> {
  const GetCheckoutCatalog(this._repository);

  final CheckoutRepository _repository;

  @override
  Future<Either<Failure, CheckoutCatalog>> call(NoParams params) => _repository.checkoutCatalog();
}
