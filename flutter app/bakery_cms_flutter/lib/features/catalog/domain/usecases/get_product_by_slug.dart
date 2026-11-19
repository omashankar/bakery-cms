import 'package:fpdart/fpdart.dart';

import '../../../../core/constants/app_strings.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/error/server_failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/product.dart';
import '../repositories/catalog_repository.dart';

class GetProductBySlug implements UseCase<Product, String> {
  const GetProductBySlug(this._repository);

  final CatalogRepository _repository;

  @override
  Future<Either<Failure, Product>> call(String params) async {
    final products = await _repository.getProducts();
    return products.flatMap((items) {
      for (final product in items) {
        if (product.slug == params) return Right(product);
      }
      return const Left(ServerFailure(AppStrings.errorNotFound));
    });
  }
}
