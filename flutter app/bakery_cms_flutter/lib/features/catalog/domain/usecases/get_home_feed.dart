import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/catalog.dart';
import '../entities/home_feed.dart';
import '../entities/product.dart';
import '../entities/product_rail.dart';
import '../entities/rail_kind.dart';
import '../repositories/catalog_repository.dart';
import '../services/product_filter.dart';

/// Builds the home screen: groups to browse, then rails of products: the
/// shop's own collections first, then best sellers and trending picks.
///
/// Products are required; the catalog is not. A shop whose groupings fail to
/// load still shows its products.
class GetHomeFeed implements UseCase<HomeFeed, bool> {
  const GetHomeFeed(this._repository);

  final CatalogRepository _repository;

  /// [params] is `forceRefresh`.
  @override
  Future<Either<Failure, HomeFeed>> call(bool params) async {
    final productsCall = _repository.getProducts(forceRefresh: params);
    final catalogCall = _repository.getCatalog(forceRefresh: params);
    final products = await productsCall;
    final catalog = (await catalogCall).getOrElse((_) => const Catalog());
    return products.map((items) => _build(items, catalog));
  }

  HomeFeed _build(List<Product> products, Catalog catalog) {
    final rails = <ProductRail>[
      for (final collection in catalog.collections)
        ProductRail(
          kind: RailKind.collection,
          group: collection,
          products: ProductFilter.inGroup(products, collection),
        ),
      ProductRail(
        kind: RailKind.bestSellers,
        products: products.where((p) => p.isBestSeller).toList(),
      ),
      ProductRail(kind: RailKind.trending, products: products.where((p) => p.isTrending).toList()),
    ].where((rail) => rail.products.isNotEmpty).toList();

    return HomeFeed(
      categories: catalog.categories,
      occasions: catalog.occasions,
      rails: rails,
      allProducts: products,
      catalog: catalog,
    );
  }
}
