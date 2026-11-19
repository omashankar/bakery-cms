import '../repositories/recently_viewed_repository.dart';

/// Remembers that the customer opened a product, for "Recently viewed".
class RecordProductView {
  const RecordProductView(this._repository);

  final RecentlyViewedRepository _repository;

  Future<void> call(String slug) => _repository.record(slug);
}
