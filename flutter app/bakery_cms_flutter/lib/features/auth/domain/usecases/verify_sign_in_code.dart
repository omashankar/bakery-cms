import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/customer.dart';
import '../repositories/auth_repository.dart';
import 'verify_code_params.dart';

class VerifySignInCode implements UseCase<Customer, VerifyCodeParams> {
  const VerifySignInCode(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, Customer>> call(VerifyCodeParams params) =>
      _repository.verifyCode(email: params.email.trim().toLowerCase(), code: params.code.trim());
}
