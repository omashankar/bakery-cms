import '../repositories/recently_viewed_repository.dart';

/// The recently viewed slugs now, then after every change.
class WatchRecentlyViewed {
  const WatchRecentlyViewed(this._repository);

  final RecentlyViewedRepository _repository;

  Stream<List<String>> call() async* {
    yield _repository.slugs;
    yield* _repository.changes;
  }
}
