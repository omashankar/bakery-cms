import 'package:get_it/get_it.dart';

import 'data/datasources/checkout_remote_data_source.dart';
import 'data/datasources/checkout_remote_data_source_impl.dart';
import 'data/datasources/geolocator_location_data_source.dart';
import 'data/datasources/location_data_source.dart';
import 'data/datasources/payment_data_source.dart';
import 'data/datasources/razorpay_payment_data_source.dart';
import 'data/repositories/checkout_repository_impl.dart';
import 'data/repositories/location_service_impl.dart';
import 'data/repositories/payment_gateway_impl.dart';
import 'data/utils/order_id_generator.dart';
import 'domain/entities/geo_point.dart';
import 'domain/repositories/checkout_repository.dart';
import 'domain/repositories/location_service.dart';
import 'domain/repositories/payment_gateway.dart';
import 'domain/usecases/check_delivery_pin.dart';
import 'domain/usecases/check_online_payment.dart';
import 'domain/usecases/get_checkout_catalog.dart';
import 'domain/usecases/estimate_quote.dart';
import 'domain/usecases/get_current_location.dart';
import 'domain/usecases/place_order.dart';
import 'presentation/bloc/checkout_bloc.dart';
import 'presentation/bloc/checkout_step_cubit.dart';
import 'presentation/bloc/map_picker_cubit.dart';

/// Checkout's dependencies. Needs `ApiClient`, the addresses feature
/// (`registerAddressesFeature`) and the delivery area feature
/// (`registerDeliveryAreaFeature`, for the PIN directory) registered first.
///
/// `MapPickerCubit` takes the starting pin as `param1`:
/// `GetIt.I<MapPickerCubit>(param1: initial)`.
void registerCheckoutFeature(GetIt sl) {
  sl
    // Data
    ..registerLazySingleton<CheckoutRemoteDataSource>(() => CheckoutRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<PaymentDataSource>(() => const RazorpayPaymentDataSource())
    ..registerLazySingleton<LocationDataSource>(() => const GeolocatorLocationDataSource())
    ..registerLazySingleton<CheckoutRepository>(
      () => CheckoutRepositoryImpl(sl(), orderEvents: sl()),
    )
    ..registerLazySingleton<PaymentGateway>(() => PaymentGatewayImpl(sl()))
    ..registerLazySingleton<LocationService>(() => LocationServiceImpl(sl()))
    // Domain
    ..registerLazySingleton(() => EstimateQuote(sl()))
    ..registerLazySingleton(() => CheckDeliveryPin(sl()))
    ..registerLazySingleton(() => CheckOnlinePayment(sl()))
    ..registerLazySingleton(() => GetCheckoutCatalog(sl()))
    ..registerLazySingleton(() => GetCurrentLocation(sl()))
    ..registerLazySingleton(() => PlaceOrder(repository: sl(), gateway: sl()))
    // Presentation
    ..registerFactory(
      () => CheckoutBloc(
        estimateQuote: sl(),
        checkDeliveryPin: sl(),
        placeOrder: sl(),
        paymentGateway: sl(),
        newOrderId: generateOrderId,
        loadAddressBook: sl(),
        rememberAddress: sl(),
        checkOnlinePayment: sl(),
        getCheckoutCatalog: sl(),
        findPincodePlace: sl(),
      ),
    )
    ..registerFactoryParam<MapPickerCubit, GeoPoint?, void>(
      (initial, _) => MapPickerCubit(sl(), initial: initial),
    )
    ..registerFactory(CheckoutStepCubit.new);
}
