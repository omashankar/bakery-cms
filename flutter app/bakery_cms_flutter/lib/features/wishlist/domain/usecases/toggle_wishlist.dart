import '../repositories/wishlist_repository.dart';

/// Saves a product for later, or forgets it if it was saved.
class ToggleWishlist {
  const ToggleWishlist(this._repository);

  final WishlistRepository _repository;

  Future<void> call(String slug) => _repository.toggle(slug);
}
