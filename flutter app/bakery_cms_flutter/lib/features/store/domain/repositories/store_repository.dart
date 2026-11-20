import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/store_config.dart';

abstract interface class StoreRepository {
  Future<Either<Failure, StoreConfig>> getConfig();
}
