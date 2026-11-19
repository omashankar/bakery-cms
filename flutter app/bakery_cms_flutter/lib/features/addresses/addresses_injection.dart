import 'package:get_it/get_it.dart';

import '../auth/domain/repositories/auth_repository.dart';
import '../checkout/data/utils/order_id_generator.dart';
import 'data/datasources/address_book_remote_data_source.dart';
import 'data/datasources/address_book_remote_data_source_impl.dart';
import 'data/repositories/address_book_repository_impl.dart';
import 'domain/repositories/address_book_repository.dart';
import 'domain/usecases/delete_address.dart';
import 'domain/usecases/load_address_book.dart';
import 'domain/usecases/remember_address.dart';
import 'domain/usecases/save_address.dart';
import 'domain/usecases/set_default_address.dart';
import 'presentation/bloc/address_book_cubit.dart';

/// Register after `registerAuthFeature` (the book is dropped when the
/// signed-in customer changes) and before `registerCheckoutFeature`, which
/// prefills from it and saves the address an order went to.
void registerAddressesFeature(GetIt sl) {
  sl
    ..registerLazySingleton<AddressBookRemoteDataSource>(
      () => AddressBookRemoteDataSourceImpl(sl(), sl()),
    )
    ..registerLazySingleton<AddressBookRepository>(
      () => AddressBookRepositoryImpl(
        sl(),
        sessionChanges: sl<AuthRepository>().customerChanges,
      ),
    )
    ..registerLazySingleton(() => LoadAddressBook(sl()))
    // A random UUID: the shop only needs it unique within the book.
    ..registerLazySingleton(() => SaveAddress(sl(), newId: generateOrderId))
    ..registerLazySingleton(() => DeleteAddress(sl()))
    ..registerLazySingleton(() => SetDefaultAddress(sl()))
    ..registerLazySingleton(() => RememberAddress(sl(), newId: generateOrderId))
    ..registerFactory(
      () => AddressBookCubit(
        loadAddressBook: sl(),
        saveAddress: sl(),
        deleteAddress: sl(),
        setDefaultAddress: sl(),
      ),
    );
}
