import '../../../catalog/domain/entities/catalog.dart';
import '../../../catalog/domain/entities/group_kind.dart';
import '../../../catalog/domain/entities/product.dart';
import '../../../catalog/domain/entities/product_group.dart';

/// Turns the slugs a home section names into the products and groups the
/// app already holds.
///
/// The layout carries slugs only (the app downloads the whole catalogue
/// anyway), so a product the shop has since hidden or deleted simply drops
/// out of its row instead of drawing an empty card.
class HomeCatalogIndex {
  HomeCatalogIndex({required List<Product> products, required Catalog catalog})
    : _products = {for (final product in products) product.slug: product},
      _catalog = catalog;

  final Map<String, Product> _products;
  final Catalog _catalog;

  /// The products behind [slugs], in that order, each once.
  List<Product> products(Iterable<String> slugs, {int? max}) {
    final seen = <String>{};
    final found = <Product>[];
    for (final slug in slugs) {
      final product = _products[slug];
      if (product == null || !seen.add(slug)) continue;
      found.add(product);
      if (max != null && found.length >= max) break;
    }
    return found;
  }

  /// The groups behind [slugs], in that order. A slug is looked up as a
  /// category first, as the website's `/store/collections/<slug>` does.
  List<ProductGroup> groups(Iterable<String> slugs) => [for (final slug in slugs) ?group(slug)];

  /// The group named [slug]: of [kind] when given, otherwise a category, then
  /// a collection, then an occasion.
  ProductGroup? group(String slug, {GroupKind? kind}) {
    final kinds = kind == null
        ? const [GroupKind.category, GroupKind.collection, GroupKind.occasion]
        : [kind];
    for (final candidate in kinds) {
      final found = _catalog.find(candidate, slug);
      if (found != null) return found;
    }
    return null;
  }

  bool hasProduct(String slug) => _products.containsKey(slug);
}
