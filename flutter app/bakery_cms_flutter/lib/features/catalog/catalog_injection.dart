import 'package:get_it/get_it.dart';

import 'data/datasources/catalog_remote_data_source.dart';
import 'data/datasources/catalog_remote_data_source_impl.dart';
import '../media/media_injection.dart';
import 'data/datasources/photo_upload_remote_data_source.dart';
import 'data/datasources/photo_upload_remote_data_source_impl.dart';
import 'data/datasources/recently_viewed_local_data_source.dart';
import 'data/datasources/recently_viewed_local_data_source_impl.dart';
import 'data/repositories/catalog_repository_impl.dart';
import 'data/repositories/photo_upload_repository_impl.dart';
import 'data/repositories/recently_viewed_repository_impl.dart';
import 'domain/repositories/catalog_repository.dart';
import 'domain/repositories/photo_upload_repository.dart';
import 'domain/repositories/recently_viewed_repository.dart';
import 'domain/usecases/get_catalog.dart';
import 'domain/usecases/get_group_listing.dart';
import 'domain/usecases/get_home_feed.dart';
import 'domain/usecases/get_product_by_slug.dart';
import 'domain/usecases/get_related_products.dart';
import 'domain/usecases/record_product_view.dart';
import 'domain/usecases/search_products.dart';
import 'domain/usecases/upload_cake_photo.dart';
import 'domain/usecases/watch_recently_viewed.dart';
import 'domain/services/photo_print_renderer.dart';
import 'presentation/painting/canvas_photo_print_renderer.dart';
import 'presentation/painting/photo_image_decoder.dart';
import 'presentation/bloc/cake_photo/cake_photo_cubit.dart';
import 'presentation/bloc/categories/categories_cubit.dart';
import 'presentation/bloc/home/home_bloc.dart';
import 'presentation/bloc/listing_controls/listing_controls_cubit.dart';
import 'presentation/bloc/product_detail/product_detail_cubit.dart';
import 'presentation/bloc/product_list/product_list_cubit.dart';
import 'presentation/bloc/search/search_bloc.dart';

/// Needs SharedPreferences and the home layout feature registered first.
void registerCatalogFeature(GetIt sl) {
  registerMediaFeature(sl);
  sl
    ..registerLazySingleton<PhotoUploadRemoteDataSource>(
      () => PhotoUploadRemoteDataSourceImpl(sl()),
    )
    ..registerLazySingleton<PhotoUploadRepository>(() => PhotoUploadRepositoryImpl(sl()))
    ..registerLazySingleton(() => UploadCakePhoto(sl()))
    ..registerLazySingleton<PhotoPrintRenderer>(CanvasPhotoPrintRenderer.new)
    ..registerLazySingleton(() => const PhotoImageDecoder())
    ..registerFactory(() => CakePhotoCubit(sl(), sl(), sl()))
    ..registerLazySingleton<CatalogRemoteDataSource>(() => CatalogRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<CatalogRepository>(() => CatalogRepositoryImpl(sl()))
    ..registerLazySingleton(() => GetHomeFeed(sl()))
    ..registerLazySingleton(() => GetCatalog(sl()))
    ..registerLazySingleton(() => GetGroupListing(sl()))
    ..registerLazySingleton(() => SearchProducts(sl()))
    ..registerLazySingleton(() => GetProductBySlug(sl()))
    ..registerLazySingleton(() => GetRelatedProducts(sl()))
    ..registerLazySingleton<RecentlyViewedLocalDataSource>(
      () => RecentlyViewedLocalDataSourceImpl(sl()),
    )
    ..registerLazySingleton<RecentlyViewedRepository>(() => RecentlyViewedRepositoryImpl(sl()))
    ..registerLazySingleton(() => RecordProductView(sl()))
    ..registerLazySingleton(() => WatchRecentlyViewed(sl()))
    ..registerFactory(
      () => HomeBloc(getHomeFeed: sl(), getHomeLayout: sl(), watchRecentlyViewed: sl()),
    )
    ..registerFactory(() => CategoriesCubit(sl(), peekHomeLayout: sl()))
    ..registerFactory(() => ProductListCubit(sl()))
    ..registerFactory(ListingControlsCubit.new)
    ..registerFactory(() => SearchBloc(sl()))
    ..registerFactory(
      () => ProductDetailCubit(sl(), recordProductView: sl(), getRelatedProducts: sl()),
    );
}
