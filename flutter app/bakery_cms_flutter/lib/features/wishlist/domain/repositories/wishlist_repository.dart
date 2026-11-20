/// The products this customer saved for later, kept on the phone only, like
/// the website's per-browser wishlist (`bakery-cms-wishlist`). Signed out, it
/// works as a guest's list; when a customer's session ENDS it is wiped, as the
/// website wipes it in `clearLocalCustomerData`: on a shared phone the next
/// person must not inherit the last customer's saved products.
abstract interface class WishlistRepository {
  /// Newest first.
  List<String> get slugs;

  /// Emits [slugs] after every change.
  Stream<List<String>> get changes;

  /// Saves [slug] at the front, or forgets it if it is already saved.
  Future<void> toggle(String slug);

  /// Forgets [slug]; nothing happens if it was not saved.
  Future<void> remove(String slug);

  /// Forgets every saved product.
  Future<void> clear();
}
