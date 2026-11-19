import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/product.dart';
import '../repositories/catalog_repository.dart';

/// "You may also like" under a product: others from the same category (or,
/// for a product in none, the same occasion), the ones in stock first.
///
/// Reads the session's cached product list, the same one the product page
/// was found in, so it costs no request of its own.
class GetRelatedProducts implements UseCase<List<Product>, Product> {
  const GetRelatedProducts(this._repository);

  /// Enough to fill a row a customer swipes through, not a second listing.
  static const int limit = 10;

  final CatalogRepository _repository;

  @override
  Future<Either<Failure, List<Product>>> call(Product params) async {
    final products = await _repository.getProducts();
    return products.map((items) => related(params, items));
  }

  /// The pure rule, so it can be tested without a repository.
  static List<Product> related(Product product, List<Product> all) {
    final groups = product.categoryIds.isNotEmpty
        ? product.categoryIds.toSet()
        : product.occasionIds.toSet();
    if (groups.isEmpty) return const [];
    bool sharesGroup(Product other) =>
        (product.categoryIds.isNotEmpty ? other.categoryIds : other.occasionIds).any(
          groups.contains,
        );
    final matches = [
      for (final other in all)
        if (other.slug != product.slug && sharesGroup(other)) other,
    ];
    final inStock = matches.where((p) => p.isAvailable);
    final soldOut = matches.where((p) => !p.isAvailable);
    return [...inStock, ...soldOut].take(limit).toList(growable: false);
  }
}
