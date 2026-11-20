/// The slugs of the products saved on this phone, newest first.
abstract interface class WishlistLocalDataSource {
  List<String> read();

  Future<void> write(List<String> slugs);
}
