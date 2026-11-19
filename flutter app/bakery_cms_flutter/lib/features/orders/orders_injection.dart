import 'package:get_it/get_it.dart';

import '../auth/domain/repositories/auth_repository.dart';
import 'data/datasources/orders_remote_data_source.dart';
import 'data/datasources/orders_remote_data_source_impl.dart';
import 'data/repositories/orders_repository_impl.dart';
import 'domain/repositories/orders_repository.dart';
import 'domain/usecases/cancel_order.dart';
import 'domain/usecases/email_invoice.dart';
import 'domain/usecases/get_my_orders.dart';
import 'domain/usecases/get_order_details.dart';
import 'domain/usecases/watch_order_changes.dart';
import 'presentation/bloc/order_detail_cubit.dart';
import 'presentation/bloc/orders_bloc.dart';

/// Register after `registerAuthFeature`: the order cache is dropped whenever
/// the signed-in customer changes.
void registerOrdersFeature(GetIt sl) {
  sl
    ..registerLazySingleton<OrdersRemoteDataSource>(() => OrdersRemoteDataSourceImpl(sl()))
    ..registerLazySingleton<OrdersRepository>(
      () => OrdersRepositoryImpl(
        sl(),
        sessionChanges: sl<AuthRepository>().customerChanges,
        orderEvents: sl(),
      ),
    )
    ..registerLazySingleton(() => GetMyOrders(sl()))
    ..registerLazySingleton(() => GetOrderDetails(sl()))
    ..registerLazySingleton(() => CancelOrder(sl()))
    ..registerLazySingleton(() => EmailInvoice(sl()))
    ..registerLazySingleton(() => WatchOrderChanges(sl()))
    ..registerFactory(() => OrdersBloc(sl(), watchOrderChanges: sl()))
    ..registerFactory(
      () => OrderDetailCubit(getOrderDetails: sl(), cancelOrder: sl(), emailInvoice: sl()),
    );
}
