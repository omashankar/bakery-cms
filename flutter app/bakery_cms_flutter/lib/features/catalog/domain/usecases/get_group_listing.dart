import 'package:fpdart/fpdart.dart';

import '../../../../core/constants/app_strings.dart';
import '../../../../core/error/failure.dart';
import '../../../../core/error/server_failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/group_listing.dart';
import '../repositories/catalog_repository.dart';
import '../services/product_filter.dart';
import 'group_listing_params.dart';

class GetGroupListing implements UseCase<GroupListing, GroupListingParams> {
  const GetGroupListing(this._repository);

  final CatalogRepository _repository;

  @override
  Future<Either<Failure, GroupListing>> call(GroupListingParams params) async {
    final catalogCall = _repository.getCatalog(forceRefresh: params.forceRefresh);
    final productsCall = _repository.getProducts(forceRefresh: params.forceRefresh);
    final catalog = await catalogCall;
    final products = await productsCall;

    return catalog.flatMap((value) {
      final group = value.find(params.kind, params.slug);
      if (group == null) return const Left(ServerFailure(AppStrings.errorNotFound));
      return products.map(
        (items) => GroupListing(group: group, products: ProductFilter.inGroup(items, group)),
      );
    });
  }
}
