import '../entities/group_kind.dart';
import '../entities/product.dart';
import '../entities/product_group.dart';

/// Which products belong where. Pure, so it is tested without any I/O.
abstract final class ProductFilter {
  static List<Product> inGroup(List<Product> products, ProductGroup group) {
    switch (group.kind) {
      case GroupKind.category:
        return products.where((p) => p.categoryIds.contains(group.id)).toList();
      case GroupKind.occasion:
        return products.where((p) => p.occasionIds.contains(group.id)).toList();
      case GroupKind.collection:
        // The collection's own order, skipping ids no longer published.
        final byId = {for (final p in products) p.id: p};
        return group.productIds.map((id) => byId[id]).whereType<Product>().toList();
    }
  }

  /// Every word of [query] must appear in the name or description.
  static List<Product> search(List<Product> products, String query) {
    final words = query.toLowerCase().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
    if (words.isEmpty) return const [];
    return products.where((product) {
      final haystack = '${product.name} ${product.description}'.toLowerCase();
      return words.every(haystack.contains);
    }).toList();
  }
}
