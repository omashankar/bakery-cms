import '../repositories/wishlist_repository.dart';

/// Forgets a saved product.
class RemoveFromWishlist {
  const RemoveFromWishlist(this._repository);

  final WishlistRepository _repository;

  Future<void> call(String slug) => _repository.remove(slug);
}
