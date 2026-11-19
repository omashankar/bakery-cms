import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/coupon.dart';
import '../repositories/offers_repository.dart';

class GetLiveCoupons implements UseCase<List<Coupon>, NoParams> {
  const GetLiveCoupons(this._repository);

  final OffersRepository _repository;

  @override
  Future<Either<Failure, List<Coupon>>> call(NoParams params) => _repository.liveCoupons();
}
