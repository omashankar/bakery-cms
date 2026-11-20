import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/error/guard.dart';
import '../../domain/entities/home_layout.dart';
import '../../domain/repositories/home_layout_repository.dart';
import '../datasources/home_layout_remote_data_source.dart';

class HomeLayoutRepositoryImpl implements HomeLayoutRepository {
  HomeLayoutRepositoryImpl(this._remote);

  final HomeLayoutRemoteDataSource _remote;
  HomeLayout? _cached;

  @override
  HomeLayout? get cached => _cached;

  @override
  Future<Either<Failure, HomeLayout>> getHomeLayout({bool forceRefresh = false}) async {
    final cached = _cached;
    if (cached != null && !forceRefresh) return Right(cached);
    final result = await guard(() async => (await _remote.fetchHomeLayout()).toEntity());
    return result.match(
      // A refresh that fails keeps the page the customer was already shown.
      (failure) => cached == null ? Left(failure) : Right(cached),
      (layout) {
        _cached = layout;
        return Right(layout);
      },
    );
  }
}
