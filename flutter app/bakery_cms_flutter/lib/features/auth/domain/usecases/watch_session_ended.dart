import '../repositories/auth_repository.dart';

/// Every time this device stops holding a customer's session: sign-out,
/// account deletion, or the shop no longer recognising it.
class WatchSessionEnded {
  const WatchSessionEnded(this._repository);

  final AuthRepository _repository;

  Stream<void> call() => _repository.sessionEnded;
}
