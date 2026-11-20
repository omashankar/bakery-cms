import '../repositories/orders_repository.dart';

/// "An order was placed or cancelled": the order list reloads on it.
class WatchOrderChanges {
  const WatchOrderChanges(this._repository);

  final OrdersRepository _repository;

  Stream<void> call() => _repository.changes;
}
