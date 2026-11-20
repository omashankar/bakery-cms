import 'package:get_it/get_it.dart';

import 'data/datasources/store_remote_data_source.dart';
import 'data/datasources/store_remote_data_source_impl.dart';
import 'data/repositories/store_repository_impl.dart';
import 'domain/repositories/store_repository.dart';
import 'domain/usecases/get_store_config.dart';
import 'presentation/bloc/store_config_cubit.dart';

void registerStoreFeature(GetIt sl) {
  sl
    ..registerLazySingleton<StoreRemoteDataSource>(() => StoreRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<StoreRepository>(() => StoreRepositoryImpl(sl()))
    ..registerLazySingleton(() => GetStoreConfig(sl()))
    ..registerFactory(() => StoreConfigCubit(sl()));
}
