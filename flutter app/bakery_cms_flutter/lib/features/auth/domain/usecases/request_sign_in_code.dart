import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';
import 'request_code_params.dart';

/// Emails a 6-digit sign-in code. The shop lowercases the address itself;
/// trimming here keeps a stray space from becoming a second account.
class RequestSignInCode implements UseCase<Unit, RequestCodeParams> {
  const RequestSignInCode(this._repository);

  final AuthRepository _repository;

  @override
  Future<Either<Failure, Unit>> call(RequestCodeParams params) {
    final name = params.name?.trim();
    return _repository.requestCode(
      email: params.email.trim().toLowerCase(),
      name: (name == null || name.isEmpty) ? null : name,
    );
  }
}
