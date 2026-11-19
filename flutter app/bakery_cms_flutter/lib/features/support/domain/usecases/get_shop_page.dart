import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/shop_page.dart';
import '../repositories/support_repository.dart';

/// Takes the page's slug.
class GetShopPage implements UseCase<ShopPage, String> {
  const GetShopPage(this._repository);

  final SupportRepository _repository;

  @override
  Future<Either<Failure, ShopPage>> call(String slug) => _repository.getPage(slug);
}
