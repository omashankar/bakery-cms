import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_result.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_status.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/widgets/pin_status_line.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Under the pin, the delivery charge must agree with the price box: an
/// order over the free-delivery amount pays nothing, whatever the zone costs.
void main() {
  const zone99 = PinCheckResult(status: PinStatus.eligible, charge: 99);

  Future<void> pump(WidgetTester tester, {required bool deliveryFree}) => tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: PinStatusLine(
          status: ViewStatus.success,
          result: zone99,
          currency: 'INR',
          deliveryFree: deliveryFree,
        ),
      ),
    ),
  );

  testWidgets('a waived zone fee reads Free, not the zone price', (tester) async {
    await pump(tester, deliveryFree: true);
    expect(find.textContaining('Free'), findsOneWidget);
    expect(find.textContaining('99'), findsNothing);
  });

  testWidgets('below the free-delivery amount the zone fee is shown', (tester) async {
    await pump(tester, deliveryFree: false);
    expect(find.textContaining('99'), findsOneWidget);
    expect(find.textContaining('Free'), findsNothing);
  });
}
