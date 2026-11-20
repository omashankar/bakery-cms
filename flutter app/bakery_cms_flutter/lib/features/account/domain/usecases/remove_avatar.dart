import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../auth/domain/entities/customer.dart';
import '../repositories/account_repository.dart';

class RemoveAvatar implements UseCase<Customer, NoParams> {
  const RemoveAvatar(this._repository);

  final AccountRepository _repository;

  @override
  Future<Either<Failure, Customer>> call(NoParams params) => _repository.removeAvatar();
}
