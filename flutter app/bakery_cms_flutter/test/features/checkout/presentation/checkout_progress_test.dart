import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/checkout_strings.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_step.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_step_cubit.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/widgets/checkout_progress.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CheckoutProgress', () {
    Future<List<CheckoutStep>> pumpAt(WidgetTester tester, CheckoutStep current) async {
      final selected = <CheckoutStep>[];
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: Scaffold(
            body: SizedBox(
              width: 360,
              child: CheckoutProgress(current: current, onSelect: selected.add),
            ),
          ),
        ),
      );
      return selected;
    }

    testWidgets('steps before the current one are ticked; it and later ones are numbered', (
      tester,
    ) async {
      await pumpAt(tester, CheckoutStep.personalise);

      expect(find.byIcon(Icons.check), findsNWidgets(2)); // Cart and Address
      expect(find.text('3'), findsOneWidget); // Personalize, current
      expect(find.text('4'), findsOneWidget); // Payment, to come
      expect(find.text('1'), findsNothing);
    });

    testWidgets('a done step can be gone back to; the current and later ones cannot', (
      tester,
    ) async {
      final selected = await pumpAt(tester, CheckoutStep.personalise);

      await tester.tap(find.text(CheckoutStrings.stepAddress));
      await tester.tap(find.text(CheckoutStrings.stepPersonalise));
      await tester.tap(find.text(CheckoutStrings.stepPayment));
      expect(selected, [CheckoutStep.address]);
    });

    testWidgets('a screen reader hears which step of four it is', (tester) async {
      final semantics = tester.ensureSemantics();
      await pumpAt(tester, CheckoutStep.address);
      expect(
        find.bySemanticsLabel(CheckoutStrings.stepOf(2, 4, CheckoutStrings.stepAddress)),
        findsOneWidget,
      );
      semantics.dispose();
    });
  });

  group('CheckoutStepCubit', () {
    blocTest<CheckoutStepCubit, CheckoutStep>(
      'starts at Address and says a step only when it changes',
      build: CheckoutStepCubit.new,
      act: (cubit) => cubit
        ..reached(CheckoutStep.address)
        ..reached(CheckoutStep.payment)
        ..reached(CheckoutStep.payment),
      expect: () => [CheckoutStep.payment],
    );

    test('a step tapped in the header is passed on to the screen', () async {
      final cubit = CheckoutStepCubit();
      final jumps = <CheckoutStep>[];
      final sub = cubit.jumps.listen(jumps.add);
      cubit.jumpTo(CheckoutStep.address);
      await Future<void>.delayed(Duration.zero);
      expect(jumps, [CheckoutStep.address]);
      expect(cubit.state, CheckoutStep.address);
      await sub.cancel();
      await cubit.close();
    });
  });
}
