import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../entities/coupon.dart';

abstract interface class OffersRepository {
  /// The shop's live coupons. Read once and kept for a few minutes, so a
  /// customer moving between product pages and the cart does not ask again.
  Future<Either<Failure, List<Coupon>>> liveCoupons();
}
