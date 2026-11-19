import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/delivery_area.dart';
import '../../domain/repositories/delivery_area_repository.dart';
import '../datasources/delivery_area_local_data_source.dart';
import '../datasources/delivery_area_remote_data_source.dart';
import '../models/delivery_area_model.dart';

class DeliveryAreaRepositoryImpl implements DeliveryAreaRepository {
  const DeliveryAreaRepositoryImpl({
    required DeliveryAreaRemoteDataSource remote,
    required DeliveryAreaLocalDataSource local,
  }) : _remote = remote,
       _local = local;

  final DeliveryAreaRemoteDataSource _remote;
  final DeliveryAreaLocalDataSource _local;

  @override
  Future<Either<Failure, DeliveryArea>> check(String pincode) =>
      guard(() async => (await _remote.check(pincode)).toEntity());

  @override
  Future<Either<Failure, DeliveryArea?>> saved() =>
      guard(() async => (await _local.read())?.toEntity());

  @override
  Future<Either<Failure, Unit>> save(DeliveryArea area) => guard(() async {
    await _local.write(DeliveryAreaModel.fromEntity(area));
    return unit;
  });
}
