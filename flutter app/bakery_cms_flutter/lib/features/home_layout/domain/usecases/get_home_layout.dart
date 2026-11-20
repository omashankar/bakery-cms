import 'package:fpdart/fpdart.dart';

import '../../../../core/error/failure.dart';
import '../../../../core/usecase/usecase.dart';
import '../entities/home_layout.dart';
import '../repositories/home_layout_repository.dart';

class GetHomeLayout implements UseCase<HomeLayout, bool> {
  const GetHomeLayout(this._repository);

  final HomeLayoutRepository _repository;

  /// [params] is `forceRefresh`.
  @override
  Future<Either<Failure, HomeLayout>> call(bool params) =>
      _repository.getHomeLayout(forceRefresh: params);
}
