import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/catalog.dart';
import '../../domain/entities/product.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../datasources/catalog_remote_data_source.dart';

/// Keeps the catalogue in memory for the session.
///
/// Home, listings, search and product pages all read the same ~150 KB list,
/// so it is fetched once, and a request already in flight is shared rather
/// than repeated when two screens ask at the same moment.
class CatalogRepositoryImpl implements CatalogRepository {
  CatalogRepositoryImpl(this._remote);

  final CatalogRemoteDataSource _remote;

  Future<List<Product>>? _products;
  Future<Catalog>? _catalog;

  @override
  Future<Either<Failure, List<Product>>> getProducts({bool forceRefresh = false}) {
    if (forceRefresh) _products = null;
    final pending = _products ??= _remote.fetchProducts().then(
      (models) => models.map((m) => m.toEntity()).toList(),
    );
    return guard(
      () => pending.catchError((Object error) {
        _products = null; // a failure is never cached
        throw error;
      }),
    );
  }

  @override
  Future<Either<Failure, Catalog>> getCatalog({bool forceRefresh = false}) {
    if (forceRefresh) _catalog = null;
    final pending = _catalog ??= _remote.fetchCatalog().then((model) => model.toEntity());
    return guard(
      () => pending.catchError((Object error) {
        _catalog = null;
        throw error;
      }),
    );
  }
}
