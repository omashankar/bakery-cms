import 'dart:async';

import 'package:bakery_cms_flutter/core/error/network_exception.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/features/orders/data/datasources/orders_remote_data_source.dart';
import 'package:bakery_cms_flutter/features/orders/data/models/order_model.dart';
import 'package:bakery_cms_flutter/features/orders/data/repositories/orders_repository_impl.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order_status.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import '../../order_fixtures.dart';

class _MockRemote extends Mock implements OrdersRemoteDataSource {}

void main() {
  late _MockRemote remote;
  late StreamController<Object?> session;
  late OrdersRepositoryImpl repository;

  final older = OrderModel.fromJson(
    orderJson(orderNumber: 'BK-OLD', placedAt: '2026-11-01T09:00:00.000Z'),
  );
  final newer = OrderModel.fromJson(
    orderJson(orderNumber: 'BK-NEW', placedAt: '2026-11-15T09:00:00.000Z'),
  );

  setUp(() {
    remote = _MockRemote();
    session = StreamController<Object?>.broadcast();
    repository = OrdersRepositoryImpl(remote, sessionChanges: session.stream);
    when(() => remote.fetchMyOrders()).thenAnswer((_) async => [older, newer]);
  });

  tearDown(() async {
    await repository.dispose();
    await session.close();
  });

  test('lists newest first', () async {
    final result = await repository.getMyOrders(forceRefresh: true);
    final numbers = result.getOrElse((_) => []).map((o) => o.orderNumber);
    expect(numbers, ['BK-NEW', 'BK-OLD']);
  });

  test('a detail asks the shop again, so its status is current', () async {
    await repository.getMyOrders(forceRefresh: true);
    final result = await repository.getOrderDetails('BK-OLD');

    expect(result.isRight(), isTrue);
    verify(() => remote.fetchMyOrders()).called(2);
  });

  test('offline, a detail falls back to the list already loaded', () async {
    await repository.getMyOrders(forceRefresh: true);
    when(() => remote.fetchMyOrders()).thenThrow(const NetworkException());

    final result = await repository.getOrderDetails('BK-OLD');

    expect(result.isRight(), isTrue);
  });

  test('offline with nothing loaded is a network failure', () async {
    when(() => remote.fetchMyOrders()).thenThrow(const NetworkException());
    final result = await repository.getOrderDetails('BK-OLD');
    expect(result.getLeft().toNullable(), isA<NetworkFailure>());
  });

  test('an unknown order number is a not-found failure', () async {
    final result = await repository.getOrderDetails('BK-NOPE');
    expect(result.getLeft().toNullable(), isA<ServerFailure>());
  });

  test('a change of customer drops the cache', () async {
    await repository.getMyOrders(forceRefresh: true);
    session.add(null);
    await Future<void>.delayed(Duration.zero);
    await repository.getOrderDetails('BK-OLD');

    verify(() => remote.fetchMyOrders()).called(2);
  });

  test('a cancelled order replaces its cached copy', () async {
    await repository.getMyOrders(forceRefresh: true);
    when(() => remote.cancelOrder('BK-NEW', reason: any(named: 'reason'))).thenAnswer(
      (_) async => OrderModel.fromJson(orderJson(orderNumber: 'BK-NEW', status: 'cancelled')),
    );

    await repository.cancelOrder('BK-NEW');
    final list = await repository.getMyOrders();

    final cancelled = list.getOrElse((_) => []).firstWhere((o) => o.orderNumber == 'BK-NEW');
    expect(cancelled.status, OrderStatus.cancelled);
  });
}
