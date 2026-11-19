import 'package:get_it/get_it.dart';

import 'data/datasources/cart_local_data_source.dart';
import 'data/datasources/cart_local_data_source_impl.dart';
import 'data/repositories/cart_repository_impl.dart';
import 'domain/repositories/cart_repository.dart';
import 'domain/usecases/load_cart.dart';
import 'domain/usecases/save_cart.dart';
import 'presentation/bloc/cart_cubit.dart';

void registerCartFeature(GetIt sl) {
  sl
    ..registerLazySingleton<CartLocalDataSource>(() => CartLocalDataSourceImpl(sl()))
    ..registerLazySingleton<CartRepository>(() => CartRepositoryImpl(sl()))
    ..registerLazySingleton(() => LoadCart(sl()))
    ..registerLazySingleton(() => SaveCart(sl()))
    ..registerFactory(() => CartCubit(loadCart: sl(), saveCart: sl()));
}
