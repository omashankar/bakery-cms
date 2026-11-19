import '../entities/customer.dart';
import '../repositories/auth_repository.dart';

/// Every change to who is signed in, for as long as the app runs.
class WatchCustomer {
  const WatchCustomer(this._repository);

  final AuthRepository _repository;

  Stream<Customer?> call() => _repository.customerChanges;
}
