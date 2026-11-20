import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/cart.dart';
import '../repositories/cart_repository.dart';

class SaveCart implements UseCase<Unit, Cart> {
  const SaveCart(this._repository);

  final CartRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(Cart params) => _repository.save(params);
}
