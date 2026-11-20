import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/coupon.dart';
import '../../domain/repositories/offers_repository.dart';
import '../datasources/offers_remote_data_source.dart';

class OffersRepositoryImpl implements OffersRepository {
  OffersRepositoryImpl(this._remote, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  final OffersRemoteDataSource _remote;
  final DateTime Function() _clock;

  /// How long a read is reused. Short: an owner switching a code off should
  /// see it leave the app within minutes, and checkout re-checks it anyway.
  static const Duration freshFor = Duration(minutes: 5);

  List<Coupon>? _cached;
  DateTime? _cachedAt;
  Future<Either<Failure, List<Coupon>>>? _inFlight;

  @override
  Future<Either<Failure, List<Coupon>>> liveCoupons() {
    final cached = _cached;
    final at = _cachedAt;
    if (cached != null && at != null && _clock().difference(at) < freshFor) {
      return Future.value(Right(cached));
    }
    // Two blocks asking at once share one request.
    return _inFlight ??= _read().whenComplete(() => _inFlight = null);
  }

  Future<Either<Failure, List<Coupon>>> _read() async {
    final result = await guard(
      () async => [for (final model in await _remote.fetchCoupons()) ?model.toEntity()],
    );
    result.match((_) {}, (coupons) {
      _cached = coupons;
      _cachedAt = _clock();
    });
    return result;
  }
}
