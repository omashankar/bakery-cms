import 'package:flutter/foundation.dart';

import '../../../../core/error/server_exception.dart';
import '../../../../core/network/api_client.dart';
import '../models/coupon_model.dart';
import 'offers_remote_data_source.dart';

/// `GET /api/coupons`: public, and for a visitor only the live codes.
class OffersRemoteDataSourceImpl implements OffersRemoteDataSource {
  const OffersRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  static const String path = '/api/coupons';

  @override
  Future<List<CouponModel>> fetchCoupons() async {
    final data = await _client.get(path);
    if (data is! List) throw const ServerException();
    final coupons = <CouponModel>[];
    for (final item in data.whereType<Map<String, dynamic>>()) {
      try {
        coupons.add(CouponModel.fromJson(item));
      } catch (error) {
        debugPrint('Skipped a coupon that could not be read: $error');
      }
    }
    return coupons;
  }
}
