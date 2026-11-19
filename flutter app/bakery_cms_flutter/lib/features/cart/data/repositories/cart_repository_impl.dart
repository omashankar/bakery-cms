import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/cart.dart';
import '../../domain/repositories/cart_repository.dart';
import '../datasources/cart_local_data_source.dart';
import '../models/cart_item_model.dart';

class CartRepositoryImpl implements CartRepository {
  const CartRepositoryImpl(this._local);

  final CartLocalDataSource _local;

  @override
  Future<Either<Failure, Cart>> load() => guard(() async {
    final models = await _local.read();
    return Cart(models.map((model) => model.toEntity()).toList());
  });

  @override
  Future<Either<Failure, Unit>> save(Cart cart) => guard(() async {
    await _local.write(cart.items.map(CartItemModel.fromEntity).toList());
    return unit;
  });
}
