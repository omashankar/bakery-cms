import 'package:get_it/get_it.dart';

import 'data/datasources/home_layout_remote_data_source.dart';
import 'data/datasources/home_layout_remote_data_source_impl.dart';
import 'data/repositories/home_layout_repository_impl.dart';
import 'domain/repositories/home_layout_repository.dart';
import 'domain/usecases/get_home_layout.dart';
import 'domain/usecases/peek_home_layout.dart';

/// Needs `ApiClient` registered first. Register before the catalog feature:
/// its home page draws this layout.
void registerHomeLayoutFeature(GetIt sl) {
  sl
    ..registerLazySingleton<HomeLayoutRemoteDataSource>(() => HomeLayoutRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<HomeLayoutRepository>(() => HomeLayoutRepositoryImpl(sl()))
    ..registerLazySingleton(() => GetHomeLayout(sl()))
    ..registerLazySingleton(() => PeekHomeLayout(sl()));
}
