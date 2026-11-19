import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/no_params.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/store_config.dart';
import '../repositories/store_repository.dart';

class GetStoreConfig implements UseCase<StoreConfig, NoParams> {
  const GetStoreConfig(this._repository);

  final StoreRepository _repository;

  @override
  Future<Either<Failure, StoreConfig>> call(NoParams params) => _repository.getConfig();
}
