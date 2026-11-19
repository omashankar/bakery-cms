import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/product.dart';
import '../repositories/catalog_repository.dart';
import '../services/product_filter.dart';

/// Searches the published catalogue on the device: it is already loaded for
/// the home screen, so a search costs no request.
class SearchProducts implements UseCase<List<Product>, String> {
  const SearchProducts(this._repository);

  final CatalogRepository _repository;

  @override
  Future<Either<Failure, List<Product>>> call(String params) async {
    final products = await _repository.getProducts();
    return products.map((items) => ProductFilter.search(items, params));
  }
}
