import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/cart.dart';
import '../repositories/cart_repository.dart';

class LoadCart implements UseCase<Cart, NoParams> {
  const LoadCart(this._repository);

  final CartRepository _repository;

  @override
  Future<Either<Failure, Cart>> call(NoParams params) => _repository.load();
}
