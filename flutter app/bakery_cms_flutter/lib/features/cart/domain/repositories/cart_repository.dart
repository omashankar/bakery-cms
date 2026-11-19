import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/cart.dart';

/// The cart lives on the device, so it survives restarts and works signed out.
abstract interface class CartRepository {
  Future<Either<Failure, Cart>> load();

  Future<Either<Failure, Unit>> save(Cart cart);
}
