import 'package:get_it/get_it.dart';

import '../auth/domain/repositories/auth_repository.dart';
import 'data/datasources/wishlist_local_data_source.dart';
import 'data/datasources/wishlist_local_data_source_impl.dart';
import 'data/repositories/wishlist_repository_impl.dart';
import 'domain/repositories/wishlist_repository.dart';
import 'domain/usecases/get_wishlist_products.dart';
import 'domain/usecases/remove_from_wishlist.dart';
import 'domain/usecases/toggle_wishlist.dart';
import 'domain/usecases/watch_wishlist.dart';
import 'presentation/bloc/wishlist_cubit.dart';
import 'presentation/bloc/wishlist_page_cubit.dart';

/// Needs SharedPreferences and the catalog feature registered first, and the
/// auth feature registered before the wishlist is first read. Kept on the
/// phone, and wiped when a customer's session ends there (as the website does).
void registerWishlistFeature(GetIt sl) {
  sl
    ..registerLazySingleton<WishlistLocalDataSource>(() => WishlistLocalDataSourceImpl(sl()))
    ..registerLazySingleton<WishlistRepository>(
      () => WishlistRepositoryImpl(sl(), sessionEnded: sl<AuthRepository>().sessionEnded),
    )
    ..registerLazySingleton(() => WatchWishlist(sl()))
    ..registerLazySingleton(() => ToggleWishlist(sl()))
    ..registerLazySingleton(() => RemoveFromWishlist(sl()))
    ..registerLazySingleton(() => GetWishlistProducts(sl()))
    ..registerFactory(
      () => WishlistCubit(watchWishlist: sl(), toggleWishlist: sl(), removeFromWishlist: sl()),
    )
    ..registerFactory(() => WishlistPageCubit(watchWishlist: sl(), getWishlistProducts: sl()));
}
