import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/catalog.dart';
import '../entities/product.dart';

abstract interface class CatalogRepository {
  /// Published products. Cached for the session; [forceRefresh] refetches.
  Future<Either<Failure, List<Product>>> getProducts({bool forceRefresh = false});

  Future<Either<Failure, Catalog>> getCatalog({bool forceRefresh = false});
}
