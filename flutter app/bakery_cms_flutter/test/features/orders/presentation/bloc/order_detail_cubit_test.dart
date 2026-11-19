import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/orders/data/models/order_model.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/cancel_order.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/cancel_order_params.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/get_order_details.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/order_detail_cubit.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/order_detail_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart' hide Order;
import 'package:mocktail/mocktail.dart';

import '../../order_fixtures.dart';

class _MockGetOrderDetails extends Mock implements GetOrderDetails {}

class _MockCancelOrder extends Mock implements CancelOrder {}

void main() {
  late _MockGetOrderDetails getDetails;
  late _MockCancelOrder cancelOrder;

  const number = 'BK-20261116-4821';
  final pending = OrderModel.fromJson(orderJson()).toDetails();
  final cancelled = OrderModel.fromJson(orderJson(status: 'cancelled')).toDetails();
  final preparing = OrderModel.fromJson(orderJson(status: 'preparing')).toDetails();
  const tooLate = ServerFailure('The shop has started preparing this order.');

  setUpAll(() => registerFallbackValue(const CancelOrderParams(orderNumber: number)));

  setUp(() {
    getDetails = _MockGetOrderDetails();
    cancelOrder = _MockCancelOrder();
  });

  OrderDetailCubit build() => OrderDetailCubit(getOrderDetails: getDetails, cancelOrder: cancelOrder);

  blocTest<OrderDetailCubit, OrderDetailState>(
    'loads one order',
    setUp: () => when(() => getDetails(number)).thenAnswer((_) async => Right(pending)),
    build: build,
    act: (cubit) => cubit.load(number),
    expect: () => [
      const OrderDetailState(status: ViewStatus.loading),
      OrderDetailState(status: ViewStatus.success, details: pending),
    ],
  );

  blocTest<OrderDetailCubit, OrderDetailState>(
    'a failed load carries the message for the error view',
    setUp: () => when(() => getDetails(number)).thenAnswer((_) async => const Left(tooLate)),
    build: build,
    act: (cubit) => cubit.load(number),
    expect: () => [
      const OrderDetailState(status: ViewStatus.loading),
      OrderDetailState(status: ViewStatus.failure, errorMessage: tooLate.message),
    ],
  );

  blocTest<OrderDetailCubit, OrderDetailState>(
    'cancelling shows the order as the shop now holds it',
    setUp: () => when(() => cancelOrder(any())).thenAnswer((_) async => Right(cancelled)),
    build: build,
    seed: () => OrderDetailState(status: ViewStatus.success, details: pending),
    act: (cubit) => cubit.cancel(),
    expect: () => [
      OrderDetailState(status: ViewStatus.success, details: pending, cancelStatus: ViewStatus.loading),
      OrderDetailState(status: ViewStatus.success, details: cancelled, cancelStatus: ViewStatus.success),
    ],
    verify: (_) => verify(() => cancelOrder(const CancelOrderParams(orderNumber: number))).called(1),
  );

  blocTest<OrderDetailCubit, OrderDetailState>(
    'a refused cancel keeps the order and reports why',
    setUp: () => when(() => cancelOrder(any())).thenAnswer((_) async => const Left(tooLate)),
    build: build,
    seed: () => OrderDetailState(status: ViewStatus.success, details: pending),
    act: (cubit) => cubit.cancel(),
    expect: () => [
      OrderDetailState(status: ViewStatus.success, details: pending, cancelStatus: ViewStatus.loading),
      OrderDetailState(
        status: ViewStatus.success,
        details: pending,
        cancelStatus: ViewStatus.failure,
        cancelError: tooLate.message,
      ),
    ],
  );

  blocTest<OrderDetailCubit, OrderDetailState>(
    'an order that cannot be cancelled is never sent',
    build: build,
    seed: () => OrderDetailState(status: ViewStatus.success, details: preparing),
    act: (cubit) => cubit.cancel(),
    expect: () => <OrderDetailState>[],
    verify: (_) => verifyNever(() => cancelOrder(any())),
  );
}
