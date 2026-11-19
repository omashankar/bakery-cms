import 'package:get_it/get_it.dart';

import 'data/datasources/auth_remote_data_source.dart';
import 'data/datasources/auth_remote_data_source_impl.dart';
import 'data/repositories/auth_repository_impl.dart';
import 'domain/repositories/auth_repository.dart';
import 'domain/usecases/delete_account.dart';
import 'domain/usecases/request_sign_in_code.dart';
import 'domain/usecases/restore_session.dart';
import 'domain/usecases/sign_out.dart';
import 'domain/usecases/verify_sign_in_code.dart';
import 'domain/usecases/watch_customer.dart';
import 'domain/usecases/watch_session_ended.dart';
import 'presentation/bloc/auth_bloc.dart';
import 'presentation/bloc/login_bloc.dart';

/// Needs `ApiClient`, `CookieJar` and `SessionEvents` registered first.
void registerAuthFeature(GetIt sl) {
  sl
    ..registerLazySingleton<AuthRemoteDataSource>(() => AuthRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<AuthRepository>(
      () => AuthRepositoryImpl(remote: sl(), cookieJar: sl(), sessionEvents: sl()),
    )
    ..registerLazySingleton(() => RestoreSession(sl()))
    ..registerLazySingleton(() => WatchCustomer(sl()))
    ..registerLazySingleton(() => WatchSessionEnded(sl()))
    ..registerLazySingleton(() => SignOut(sl()))
    ..registerLazySingleton(() => DeleteAccount(sl()))
    ..registerLazySingleton(() => RequestSignInCode(sl()))
    ..registerLazySingleton(() => VerifySignInCode(sl()))
    ..registerFactory(() => AuthBloc(restoreSession: sl(), watchCustomer: sl(), signOut: sl()))
    ..registerFactory(() => LoginBloc(requestSignInCode: sl(), verifySignInCode: sl()));
}
