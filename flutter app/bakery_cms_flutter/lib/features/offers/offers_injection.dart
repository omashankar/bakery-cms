import 'package:get_it/get_it.dart';

import 'data/datasources/offers_remote_data_source.dart';
import 'data/datasources/offers_remote_data_source_impl.dart';
import 'data/repositories/offers_repository_impl.dart';
import 'domain/repositories/offers_repository.dart';
import 'domain/usecases/get_live_coupons.dart';
import 'presentation/bloc/offers_cubit.dart';

void registerOffersFeature(GetIt sl) {
  sl
    ..registerLazySingleton<OffersRemoteDataSource>(() => OffersRemoteDataSourceImpl(sl()))
    // One for the app, so its few-minute cache is shared by every screen.
    ..registerLazySingleton<OffersRepository>(() => OffersRepositoryImpl(sl()))
    ..registerLazySingleton(() => GetLiveCoupons(sl()))
    ..registerFactory(() => OffersCubit(sl()));
}
