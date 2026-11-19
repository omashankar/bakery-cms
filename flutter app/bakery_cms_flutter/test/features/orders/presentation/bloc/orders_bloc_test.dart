import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/orders/data/models/order_model.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/get_my_orders.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/get_my_orders_params.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/orders_bloc.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/orders_event.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/orders_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart' hide Order;
import 'package:mocktail/mocktail.dart';

import '../../order_fixtures.dart';

class _MockGetMyOrders extends Mock implements GetMyOrders {}

void main() {
  late _MockGetMyOrders getMyOrders;
  final order = OrderModel.fromJson(orderJson()).toEntity();
  const offline = NetworkFailure();

  setUpAll(() => registerFallbackValue(const GetMyOrdersParams()));
  setUp(() => getMyOrders = _MockGetMyOrders());

  blocTest<OrdersBloc, OrdersState>(
    'loads the orders, always fresh from the shop',
    setUp: () => when(() => getMyOrders(any())).thenAnswer((_) async => Right([order])),
    build: () => OrdersBloc(getMyOrders),
    act: (bloc) => bloc.add(const OrdersRequested()),
    expect: () => [
      const OrdersState(status: ViewStatus.loading),
      OrdersState(status: ViewStatus.success, orders: [order]),
    ],
    verify: (_) =>
        verify(() => getMyOrders(const GetMyOrdersParams(forceRefresh: true))).called(1),
  );

  blocTest<OrdersBloc, OrdersState>(
    'no orders yet is a success with an empty list',
    setUp: () => when(() => getMyOrders(any())).thenAnswer((_) async => const Right([])),
    build: () => OrdersBloc(getMyOrders),
    act: (bloc) => bloc.add(const OrdersRequested()),
    expect: () => [
      const OrdersState(status: ViewStatus.loading),
      const OrdersState(status: ViewStatus.success),
    ],
  );

  blocTest<OrdersBloc, OrdersState>(
    'a failed first load carries the failure message',
    setUp: () => when(() => getMyOrders(any())).thenAnswer((_) async => const Left(offline)),
    build: () => OrdersBloc(getMyOrders),
    act: (bloc) => bloc.add(const OrdersRequested()),
    expect: () => [
      const OrdersState(status: ViewStatus.loading),
      OrdersState(status: ViewStatus.failure, errorMessage: offline.message),
    ],
  );

  blocTest<OrdersBloc, OrdersState>(
    'a failed refresh keeps the list already shown',
    setUp: () => when(() => getMyOrders(any())).thenAnswer((_) async => const Left(offline)),
    build: () => OrdersBloc(getMyOrders),
    seed: () => OrdersState(status: ViewStatus.success, orders: [order]),
    act: (bloc) => bloc.add(const OrdersRefreshed()),
    expect: () => [
      OrdersState(status: ViewStatus.loading, orders: [order]),
      OrdersState(status: ViewStatus.failure, orders: [order], errorMessage: offline.message),
    ],
  );
}
