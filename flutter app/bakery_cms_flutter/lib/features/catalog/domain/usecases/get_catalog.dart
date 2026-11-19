import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/catalog.dart';
import '../repositories/catalog_repository.dart';

class GetCatalog implements UseCase<Catalog, bool> {
  const GetCatalog(this._repository);

  final CatalogRepository _repository;

  /// [params] is `forceRefresh`.
  @override
  Future<Either<Failure, Catalog>> call(bool params) =>
      _repository.getCatalog(forceRefresh: params);
}
