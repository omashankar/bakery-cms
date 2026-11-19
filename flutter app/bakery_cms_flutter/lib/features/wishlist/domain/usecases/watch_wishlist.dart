import '../repositories/wishlist_repository.dart';

/// The saved slugs now, then after every change.
class WatchWishlist {
  const WatchWishlist(this._repository);

  final WishlistRepository _repository;

  Stream<List<String>> call() async* {
    yield _repository.slugs;
    yield* _repository.changes;
  }
}
