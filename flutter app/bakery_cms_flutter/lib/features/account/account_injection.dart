import 'package:get_it/get_it.dart';

import '../media/media_injection.dart';
import 'data/datasources/account_remote_data_source.dart';
import 'data/datasources/account_remote_data_source_impl.dart';
import 'data/repositories/account_repository_impl.dart';
import 'domain/repositories/account_repository.dart';
import 'domain/usecases/remove_avatar.dart';
import 'domain/usecases/update_profile.dart';
import 'domain/usecases/upload_avatar.dart';
import 'presentation/bloc/avatar_cubit.dart';
import 'presentation/bloc/delete_account_cubit.dart';
import 'presentation/bloc/profile_cubit.dart';

/// Register after `registerAuthFeature`: a saved profile updates the auth
/// repository, and deleting the account goes through it.
void registerAccountFeature(GetIt sl) {
  registerMediaFeature(sl);
  sl
    ..registerLazySingleton<AccountRemoteDataSource>(() => AccountRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<AccountRepository>(
      () => AccountRepositoryImpl(remote: sl(), authRepository: sl()),
    )
    ..registerLazySingleton(() => UpdateProfile(sl()))
    ..registerLazySingleton(() => UploadAvatar(sl()))
    ..registerLazySingleton(() => RemoveAvatar(sl()))
    ..registerFactory(() => ProfileCubit(sl()))
    ..registerFactory(() => DeleteAccountCubit(sl()))
    ..registerFactory(() => AvatarCubit(sl(), sl(), sl()));
}
