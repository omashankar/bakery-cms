/// What this customer looked at, kept on the phone only (it is never sent to
/// the shop).
abstract interface class RecentlyViewedRepository {
  /// Newest first.
  List<String> get slugs;

  /// Emits [slugs] after every change.
  Stream<List<String>> get changes;

  /// Moves [slug] to the front; the oldest fall off past a small limit.
  Future<void> record(String slug);
}
