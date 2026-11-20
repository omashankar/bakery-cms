import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/shop_contact.dart';
import '../repositories/support_repository.dart';

class GetShopContact implements UseCase<ShopContact, NoParams> {
  const GetShopContact(this._repository);

  final SupportRepository _repository;

  @override
  Future<Either<Failure, ShopContact>> call(NoParams params) => _repository.getContact();
}
