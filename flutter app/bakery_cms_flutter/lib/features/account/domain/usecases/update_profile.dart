import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../auth/domain/entities/customer.dart';
import '../repositories/account_repository.dart';
import 'update_profile_params.dart';

class UpdateProfile implements UseCase<Customer, UpdateProfileParams> {
  const UpdateProfile(this._repository);

  final AccountRepository _repository;

  @override
  Future<Either<Failure, Customer>> call(UpdateProfileParams params) {
    // Always sent, empty included: an empty phone is how a customer removes
    // their number. Left out, the shop kept the old one and sent it back.
    return _repository.updateProfile(
      name: params.name.trim(),
      phone: params.phone?.trim() ?? '',
    );
  }
}
