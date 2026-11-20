/// The slugs of the products this phone looked at, newest first.
abstract interface class RecentlyViewedLocalDataSource {
  List<String> read();

  Future<void> write(List<String> slugs);
}
