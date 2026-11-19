/// Base of every exception the data layer throws. Repositories catch these
/// and turn them into a `Failure`; nothing above the data layer sees one.
abstract class AppException implements Exception {
  const AppException([this.message]);

  /// A message written for customers (the shop's API words its 4xx refusals
  /// that way), or null when only a generic message is safe to show.
  final String? message;
}
