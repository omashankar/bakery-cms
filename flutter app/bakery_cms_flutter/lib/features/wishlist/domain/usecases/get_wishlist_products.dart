import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../../../catalog/domain/entities/product.dart';
import '../../../catalog/domain/repositories/catalog_repository.dart';

/// The saved slugs as products, in the wishlist's order.
///
/// Read from the catalogue the app already holds, so it costs no request once
/// home has loaded. A slug the shop no longer publishes is left out.
class GetWishlistProducts implements UseCase<List<Product>, List<String>> {
  const GetWishlistProducts(this._repository);

  final CatalogRepository _repository;

  @override
  Future<Either<Failure, List<Product>>> call(List<String> params) async {
    if (params.isEmpty) return const Right([]);
    final products = await _repository.getProducts();
    return products.map((items) {
      final bySlug = {for (final product in items) product.slug: product};
      return [
        for (final slug in params)
          if (bySlug[slug] case final product?) product,
      ];
    });
  }
}
