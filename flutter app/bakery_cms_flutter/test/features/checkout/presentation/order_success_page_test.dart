import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/checkout_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/orders_strings.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/utils/money_formatter.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/pages/order_success_page.dart';
import 'package:bakery_cms_flutter/features/orders/data/models/order_model.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order_details.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/cancel_order.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/email_invoice.dart';
import 'package:bakery_cms_flutter/features/orders/domain/usecases/get_order_details.dart';
import 'package:bakery_cms_flutter/features/orders/presentation/bloc/order_detail_cubit.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart' hide Order;
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';

import '../../catalog/app_cubits_harness.dart';
import '../../orders/order_fixtures.dart';

class _MockGetOrderDetails extends Mock implements GetOrderDetails {}

class _MockCancelOrder extends Mock implements CancelOrder {}

class _MockEmailInvoice extends Mock implements EmailInvoice {}

const _number = 'BK-20261116-4821';

void main() {
  late _MockGetOrderDetails getDetails;

  setUp(() {
    getDetails = _MockGetOrderDetails();
    GetIt.I.registerFactory(
      () => OrderDetailCubit(
        getOrderDetails: getDetails,
        cancelOrder: _MockCancelOrder(),
        emailInvoice: _MockEmailInvoice(),
      ),
    );
  });

  tearDown(GetIt.I.reset);

  Future<void> pump(WidgetTester tester, {Map<String, dynamic>? extra, bool fails = false}) async {
    when(() => getDetails(_number)).thenAnswer(
      (_) async => fails
          ? const Left(ServerFailure('offline'))
          : Right(
              OrderDetails(
                order: OrderModel.fromJson({...orderJson(), ...?extra}).toEntity(),
                canCancel: true,
              ),
            ),
    );
    tester.view
      ..physicalSize = const Size(400, 1600)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final router = GoRouter(
      initialLocation: '/done',
      routes: [
        GoRoute(path: '/done', builder: (_, _) => const OrderSuccessPage(orderNumber: _number)),
      ],
    );
    await tester.pumpWidget(
      withAppCubits(MaterialApp.router(theme: AppTheme.light, routerConfig: router)),
    );
    await tester.pump();
    await tester.pump();
  }

  testWidgets('cash on delivery: the amount due, the day and window, the items', (tester) async {
    await pump(tester);

    expect(find.text(CheckoutStrings.successTitle), findsOneWidget);
    expect(find.text(CheckoutStrings.orderHeading(_number)), findsOneWidget);
    expect(find.text(CheckoutStrings.amountDueOnDelivery), findsOneWidget);
    expect(find.text(MoneyFormatter.format(1523.85)), findsOneWidget);
    expect(find.text(OrderStrings.cashOnDelivery), findsOneWidget);
    expect(find.text(CheckoutStrings.deliveryLabel), findsOneWidget);
    expect(find.text('4:00 PM – 5:00 PM'), findsOneWidget);
    expect(find.text('3'), findsOneWidget); // items
    expect(find.text(CheckoutStrings.continueShopping), findsOneWidget);
    expect(find.text(CheckoutStrings.trackOrder), findsOneWidget);
  });

  testWidgets('paid online: "Total paid", never "due on delivery"', (tester) async {
    await pump(tester, extra: {'paymentMethod': 'razorpay', 'paymentStatus': 'paid'});

    expect(find.text(CheckoutStrings.totalPaid), findsOneWidget);
    expect(find.text(CheckoutStrings.amountDueOnDelivery), findsNothing);
    expect(find.text(OrderStrings.onlinePayment), findsOneWidget);
  });

  testWidgets('details that cannot be read back keep the thanks and the number', (tester) async {
    await pump(tester, fails: true);

    // The order WAS placed: never "not found".
    expect(find.text(CheckoutStrings.successTitle), findsOneWidget);
    expect(find.text(CheckoutStrings.orderHeading(_number)), findsOneWidget);
    expect(find.text(CheckoutStrings.successDetailsUnavailable), findsOneWidget);
    expect(find.text(CheckoutStrings.trackOrder), findsOneWidget);
  });

  testWidgets('nothing overflows on a 360dp phone at text scale 1.3', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await pump(tester);
    tester.view.physicalSize = const Size(360, 1600);
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
