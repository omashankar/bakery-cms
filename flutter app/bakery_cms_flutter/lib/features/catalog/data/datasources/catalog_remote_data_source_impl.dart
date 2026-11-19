import 'package:flutter/foundation.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/catalog_model.dart';
import '../models/product_model.dart';
import 'catalog_remote_data_source.dart';

class CatalogRemoteDataSourceImpl implements CatalogRemoteDataSource {
  const CatalogRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  static const String _productsKey = 'products';

  @override
  Future<List<ProductModel>> fetchProducts() async {
    // A legacy route: `{ products: [...] }`, not the envelope.
    final body = await _client.get(ApiEndpoints.products);
    final list = body is Map<String, dynamic> ? body[_productsKey] : null;
    if (list is! List) throw const ServerException();

    final products = <ProductModel>[];
    for (final item in list.whereType<Map<String, dynamic>>()) {
      try {
        final model = ProductModel.fromJson(item);
        if (model.isPublished && model.slug.isNotEmpty) products.add(model);
      } catch (error) {
        // One malformed product must not empty the whole shop.
        debugPrint('Skipped a product that could not be read: $error');
      }
    }
    return products;
  }

  @override
  Future<CatalogModel> fetchCatalog() async {
    final data = await _client.get(ApiEndpoints.catalog);
    if (data is! Map<String, dynamic>) throw const ServerException();
    return CatalogModel.fromJson(data);
  }
}
