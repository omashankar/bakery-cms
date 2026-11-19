/// The three ways the shop groups products. [path] is the segment used in
/// `AppRoutes.group`.
enum GroupKind {
  category('category'),
  occasion('occasion'),
  collection('collection');

  const GroupKind(this.path);

  final String path;

  static GroupKind? fromPath(String? value) {
    for (final kind in GroupKind.values) {
      if (kind.path == value) return kind;
    }
    return null;
  }
}
