import 'package:get_it/get_it.dart';

import 'data/datasources/delivery_area_local_data_source.dart';
import 'data/datasources/delivery_area_local_data_source_impl.dart';
import 'data/datasources/delivery_area_remote_data_source.dart';
import 'data/datasources/delivery_area_remote_data_source_impl.dart';
import 'data/datasources/pincode_directory_remote_data_source.dart';
import 'data/datasources/pincode_directory_remote_data_source_impl.dart';
import 'data/repositories/delivery_area_repository_impl.dart';
import 'data/repositories/pincode_directory_repository_impl.dart';
import 'domain/repositories/delivery_area_repository.dart';
import 'domain/repositories/pincode_directory_repository.dart';
import 'domain/usecases/check_delivery_area.dart';
import 'domain/usecases/find_pincode_place.dart';
import 'domain/usecases/load_delivery_area.dart';
import 'domain/usecases/save_delivery_area.dart';
import 'presentation/bloc/delivery_area_cubit.dart';
import 'presentation/bloc/pincode_check_cubit.dart';
import 'presentation/bloc/pincode_place_bloc.dart';

/// The customer's delivery PIN code. Needs `ApiClient` and
/// `SharedPreferences` registered first.
///
/// `DeliveryAreaCubit` is app-wide (created once, in `App`);
/// `PincodeCheckCubit` is one per pincode sheet; `PincodePlaceBloc` one per
/// address form. The PIN directory remembers its answers app-wide.
void registerDeliveryAreaFeature(GetIt sl) {
  sl
    // Data
    ..registerLazySingleton<DeliveryAreaRemoteDataSource>(
      () => DeliveryAreaRemoteDataSourceImpl(sl()),
    )
    ..registerLazySingleton<DeliveryAreaLocalDataSource>(
      () => DeliveryAreaLocalDataSourceImpl(sl()),
    )
    ..registerLazySingleton<DeliveryAreaRepository>(
      () => DeliveryAreaRepositoryImpl(remote: sl(), local: sl()),
    )
    ..registerLazySingleton<PincodeDirectoryRemoteDataSource>(
      () => PincodeDirectoryRemoteDataSourceImpl(sl()),
    )
    ..registerLazySingleton<PincodeDirectoryRepository>(() => PincodeDirectoryRepositoryImpl(sl()))
    // Domain
    ..registerLazySingleton(() => CheckDeliveryArea(sl()))
    ..registerLazySingleton(() => LoadDeliveryArea(sl()))
    ..registerLazySingleton(() => SaveDeliveryArea(sl()))
    ..registerLazySingleton(() => FindPincodePlace(sl()))
    // Presentation
    ..registerFactory(
      () => DeliveryAreaCubit(
        loadDeliveryArea: sl(),
        saveDeliveryArea: sl(),
        checkDeliveryArea: sl(),
      ),
    )
    ..registerFactory(() => PincodeCheckCubit(sl()))
    ..registerFactory(() => PincodePlaceBloc(sl()));
}
