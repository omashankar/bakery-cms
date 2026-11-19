import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/constants/storage_keys.dart';
import '../../core/network/api_client.dart';
import '../../core/network/dio_factory.dart';
import '../../core/network/network_info.dart';
import '../../core/network/network_info_impl.dart';
import '../../core/network/order_events.dart';
import '../../core/network/session_events.dart';
import '../../features/account/account_injection.dart';
import '../../features/addresses/addresses_injection.dart';
import '../../features/auth/auth_injection.dart';
import '../../features/cart/cart_injection.dart';
import '../../features/catalog/catalog_injection.dart';
import '../../features/offers/offers_injection.dart';
import '../../features/product_questions/product_questions_injection.dart';
import '../../features/reviews/reviews_injection.dart';
import '../../features/home_layout/home_layout_injection.dart';
import '../../features/checkout/checkout_injection.dart';
import '../../features/delivery_area/delivery_area_injection.dart';
import '../../features/orders/orders_injection.dart';
import '../../features/store/store_injection.dart';
import '../../features/support/support_injection.dart';
import '../../features/wishlist/wishlist_injection.dart';

final GetIt sl = GetIt.instance;

/// Wires the app: core services here, then each feature registers its own
/// data sources, repositories, use cases and blocs.
Future<void> configureDependencies() async {
  final prefs = await SharedPreferences.getInstance();

  sl
    ..registerSingleton<SharedPreferences>(prefs)
    ..registerSingleton<CookieJar>(await _cookieJar())
    ..registerLazySingleton(Connectivity.new)
    ..registerLazySingleton<NetworkInfo>(() => NetworkInfoImpl(sl()))
    ..registerLazySingleton(SessionEvents.new)
    ..registerLazySingleton(OrderEvents.new)
    ..registerLazySingleton<Dio>(
      () => DioFactory.create(cookieJar: sl(), networkInfo: sl(), sessionEvents: sl()),
    )
    ..registerLazySingleton(() => ApiClient(sl()));

  registerStoreFeature(sl);
  registerHomeLayoutFeature(sl);
  registerCatalogFeature(sl);
  registerReviewsFeature(sl);
  registerProductQuestionsFeature(sl);
  registerOffersFeature(sl);
  registerWishlistFeature(sl);
  registerCartFeature(sl);
  registerAuthFeature(sl);
  registerOrdersFeature(sl);
  registerAccountFeature(sl);
  registerAddressesFeature(sl);
  registerDeliveryAreaFeature(sl);
  registerCheckoutFeature(sl);
  registerSupportFeature(sl);
}

/// A jar on disk, so the shop's sign-in cookie survives a restart. The web
/// build leaves cookies to the browser.
Future<CookieJar> _cookieJar() async {
  if (kIsWeb) return CookieJar();
  final dir = await getApplicationSupportDirectory();
  return PersistCookieJar(storage: FileStorage('${dir.path}/${StorageKeys.cookieFolder}/'));
}
