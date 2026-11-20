import '../models/catalog_model.dart';
import '../models/product_model.dart';

abstract interface class CatalogRemoteDataSource {
  /// Published products only. Throws a typed `AppException` on failure.
  Future<List<ProductModel>> fetchProducts();

  Future<CatalogModel> fetchCatalog();
}
