import 'package:bakery_cms_flutter/core/network/order_events.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/orders/data/models/order_model.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order_status.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/get_my_orders.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/get_my_orders_params.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/watch_order_changes.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/orders_bloc.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/orders_event.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/orders_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart' hide Order;
import 'package:mocktail/mocktail.dart';

import '../../order_fixtures.dart';

class _MockGetMyOrders extends Mock implements GetMyOrders {}

class _MockWatchOrderChanges extends Mock implements WatchOrderChanges {}

/// Found on the phone: the order list lives on in its tab, so after an order
/// was cancelled from its detail screen the list still said "Confirmed".
void main() {
  late _MockGetMyOrders getMyOrders;
  late _MockWatchOrderChanges watch;
  late OrderEvents events;

  final confirmed = OrderModel.fromJson(orderJson()).toEntity();
  final cancelled = OrderModel.fromJson({...orderJson(), 'status': 'cancelled'}).toEntity();

  setUpAll(() => registerFallbackValue(const GetMyOrdersParams()));

  setUp(() {
    getMyOrders = _MockGetMyOrders();
    watch = _MockWatchOrderChanges();
    events = OrderEvents();
    when(() => watch()).thenAnswer((_) => events.changed);
  });

  tearDown(() => events.dispose());

  blocTest<OrdersBloc, OrdersState>(
    'an order changing elsewhere reloads the list',
    setUp: () {
      final answers = [
        Right<Never, List<Order>>([confirmed]),
        Right<Never, List<Order>>([cancelled]),
      ];
      when(() => getMyOrders(any())).thenAnswer((_) async => answers.removeAt(0));
    },
    build: () => OrdersBloc(getMyOrders, watchOrderChanges: watch),
    act: (bloc) async {
      bloc.add(const OrdersRequested());
      await Future<void>.delayed(Duration.zero);
      events.notifyChanged();
    },
    wait: const Duration(milliseconds: 50),
    verify: (bloc) {
      expect(bloc.state.status, ViewStatus.success);
      expect(bloc.state.orders.single.status, OrderStatus.cancelled);
    },
  );

  test('closing the bloc stops listening', () async {
    when(() => getMyOrders(any())).thenAnswer((_) async => Right([confirmed]));
    final bloc = OrdersBloc(getMyOrders, watchOrderChanges: watch);
    await bloc.close();
    events.notifyChanged(); // would throw "add after close" if still listening
    await Future<void>.delayed(Duration.zero);
    verifyNever(() => getMyOrders(any()));
  });
}
