import '../models/coupon_model.dart';

abstract interface class OffersRemoteDataSource {
  Future<List<CouponModel>> fetchCoupons();
}
