import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../../auth/data/models/customer_model.dart';
import '../../../auth/domain/entities/customer.dart';
import '../../../auth/domain/repositories/auth_repository.dart';
import '../../domain/repositories/account_repository.dart';
import '../datasources/account_remote_data_source.dart';

class AccountRepositoryImpl implements AccountRepository {
  const AccountRepositoryImpl({
    required AccountRemoteDataSource remote,
    required AuthRepository authRepository,
  })  : _remote = remote,
        _authRepository = authRepository;

  final AccountRemoteDataSource _remote;

  /// Told about the saved account, so every screen showing the customer
  /// (through `AuthBloc`) updates at once.
  final AuthRepository _authRepository;

  @override
  Future<Either<Failure, Customer>> updateProfile({required String name, String? phone}) =>
      _saved(() => _remote.updateProfile(name: name, phone: phone));

  @override
  Future<Either<Failure, Customer>> uploadAvatar(String filePath) =>
      _saved(() => _remote.uploadAvatar(filePath));

  @override
  Future<Either<Failure, Customer>> removeAvatar() => _saved(_remote.removeAvatar);

  Future<Either<Failure, Customer>> _saved(Future<CustomerModel> Function() call) =>
      guard(() async {
        final customer = (await call()).toEntity();
        _authRepository.customerUpdated(customer);
        return customer;
      });
}
