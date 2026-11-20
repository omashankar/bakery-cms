import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../auth/domain/entities/customer.dart';
import '../repositories/account_repository.dart';

/// A photo file on the phone in, the account with it as the avatar out.
class UploadAvatar implements UseCase<Customer, String> {
  const UploadAvatar(this._repository);

  final AccountRepository _repository;

  @override
  Future<Either<Failure, Customer>> call(String params) => _repository.uploadAvatar(params);
}
