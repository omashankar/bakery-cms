import 'package:bakery_cms_flutter/core/constants/strings/checkout_strings.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_result.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_found.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_status.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_bloc.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_event.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/bloc/checkout_state.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/widgets/minimum_order_alert.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/widgets/payment_section.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/widgets/pin_status_line.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/widgets/place_order_bar.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/widgets/terms_section.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/cancellation_class.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import '../checkout_fixtures.dart';

class _MockCheckoutBloc extends MockBloc<CheckoutEvent, CheckoutState> implements CheckoutBloc {}

void main() {
  setUpAll(() => registerFallbackValue(const CheckoutTermsToggled(false)));

  group('what the shop said about the pin', () {
    Future<void> pump(
      WidgetTester tester,
      PinCheckResult pin, {
      String typed = '324001',
      ValueChanged<String>? onUse,
    }) => tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PinStatusLine(
            status: ViewStatus.success,
            result: pin,
            currency: 'INR',
            pincode: typed,
            onUsePincode: onUse ?? (_) {},
          ),
        ),
      ),
    );

    const mismatch = PinCheckResult(
      status: PinStatus.mismatch,
      message: 'This pin is in PIN 324005, not 324001.',
      field: 'pincode',
      found: PinFound(postalCode: '324005', formattedAddress: 'Talwandi, Kota'),
    );

    testWidgets('a PIN mismatch says the shop\'s sentence and offers "Use PIN 324005"', (
      tester,
    ) async {
      String? used;
      await pump(tester, mismatch, onUse: (code) => used = code);

      expect(find.text('This pin is in PIN 324005, not 324001.'), findsOneWidget);
      expect(find.text('Pin at: Talwandi, Kota'), findsOneWidget);
      expect(find.text(CheckoutStrings.pinRefused), findsNothing, reason: 'not the generic line');
      await tester.tap(find.text('Use PIN 324005'));
      expect(used, '324005');
    });

    testWidgets('no "Use PIN" once the box already holds that PIN', (tester) async {
      await pump(tester, mismatch, typed: '324005');
      expect(find.textContaining('Use PIN'), findsNothing);
    });

    testWidgets('outside: the distance to the nearest area, and where the pin is', (tester) async {
      await pump(
        tester,
        const PinCheckResult(
          status: PinStatus.outside,
          message: 'We do not deliver here yet.',
          found: PinFound(formattedAddress: 'Borkheda'),
          kmToArea: 4.6,
        ),
      );
      expect(find.text('We do not deliver here yet.'), findsOneWidget);
      expect(find.text('Pin is near: Borkheda'), findsOneWidget);
      expect(find.textContaining('About 5 km from where we deliver'), findsOneWidget);
    });

    testWidgets('under 1 km reads as 1, as on the website', (tester) async {
      await pump(tester, const PinCheckResult(status: PinStatus.outside, kmToArea: 0.3));
      expect(find.textContaining('About 1 km'), findsOneWidget);
      expect(find.text(CheckoutStrings.pinOutside), findsOneWidget, reason: 'no message: fallback');
    });

    testWidgets('eligible: the PIN at the pin, the one typed, the city note and the choices', (
      tester,
    ) async {
      String? used;
      await pump(
        tester,
        const PinCheckResult(
          status: PinStatus.eligible,
          charge: 99,
          postalCode: '324005',
          otherPincodes: ['324007'],
          cityNote: 'Kota city delivery',
        ),
        onUse: (code) => used = code,
      );
      expect(
        find.text('PIN code here (nearest post office): 324005 · your address says 324001'),
        findsOneWidget,
      );
      expect(find.text('Kota city delivery'), findsOneWidget);
      expect(find.text(CheckoutStrings.use), findsOneWidget);
      await tester.tap(find.text('324007'));
      expect(used, '324007');
    });

    testWidgets('eligible with no post office near: asks to check the typed PIN', (tester) async {
      await pump(tester, const PinCheckResult(status: PinStatus.eligible));
      expect(find.text(CheckoutStrings.noPincodeHere('324001')), findsOneWidget);
    });
  });

  group('the bottom of checkout', () {
    late _MockCheckoutBloc bloc;

    setUp(() => bloc = _MockCheckoutBloc());

    CheckoutState shown({
      bool accepted = false,
      String? error,
      double minimum = 0,
      String terms = '',
      List<String> codBlockedBy = const [],
    }) => CheckoutState(
      setupStatus: ViewStatus.success,
      items: cart.items,
      checkoutTerms: terms,
      cancellationPolicyText: 'Full policy words.',
      policyClasses: const [CancellationClass.nonCancellable, CancellationClass.standard],
      termsAccepted: accepted,
      termsError: error,
      minOrderValue: minimum,
      onlineAvailable: true,
      codOffered: true,
      codBlockedBy: codBlockedBy,
      paymentMethod: PaymentMethod.online,
      quote: quote,
      estimateStatus: ViewStatus.success,
    );

    Future<void> pump(WidgetTester tester, CheckoutState state, Widget child) {
      when(() => bloc.state).thenReturn(state);
      return tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: BlocProvider<CheckoutBloc>.value(
              value: bloc,
              child: SingleChildScrollView(child: child),
            ),
          ),
        ),
      );
    }

    testWidgets('the policy lines and the shop\'s terms, unticked, beside a tick that reports', (
      tester,
    ) async {
      await pump(tester, shown(terms: 'I agree to Sweet Crumbs\' terms.'), const TermsSection());

      expect(find.text('• Cannot be cancelled once ordered.'), findsOneWidget);
      expect(find.text('• Can be cancelled until we start preparing it.'), findsOneWidget);
      expect(find.text(CheckoutStrings.readFullPolicy), findsOneWidget);
      expect(find.text('I agree to Sweet Crumbs\' terms.'), findsOneWidget);
      final box = tester.widget<CheckboxListTile>(find.byType(CheckboxListTile));
      expect(box.value, isFalse, reason: 'never pre-ticked');

      await tester.tap(find.byType(CheckboxListTile));
      verify(() => bloc.add(const CheckoutTermsToggled(true))).called(1);
    });

    testWidgets('a shop with no terms of its own gets the website\'s default line', (tester) async {
      await pump(tester, shown(), const TermsSection());
      expect(find.text(CheckoutStrings.defaultTerms), findsOneWidget);
    });

    testWidgets('the refusal is said under the box', (tester) async {
      await pump(tester, shown(error: CheckoutStrings.acceptTerms), const TermsSection());
      expect(find.text(CheckoutStrings.acceptTerms), findsOneWidget);
    });

    testWidgets('under the minimum: the alert, and a greyed Place order', (tester) async {
      await pump(
        tester,
        shown(accepted: true, minimum: 2000),
        Column(
          children: [
            const MinimumOrderAlert(),
            PlaceOrderBar(onPressed: () {}),
          ],
        ),
      );
      expect(
        find.text('Minimum order value is ₹2,000. Add more items to continue.'),
        findsOneWidget,
      );
      final button = tester.widget<FilledButton>(find.byType(FilledButton));
      expect(button.onPressed, isNull);
    });

    testWidgets('over the minimum: no alert, and Place order works', (tester) async {
      await pump(
        tester,
        shown(accepted: true, minimum: 500),
        Column(
          children: [
            const MinimumOrderAlert(),
            PlaceOrderBar(onPressed: () {}),
          ],
        ),
      );
      expect(find.textContaining('Minimum order value'), findsNothing);
      expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNotNull);
    });

    testWidgets('no cash option says which item takes no cash', (tester) async {
      await pump(tester, shown(codBlockedBy: ['Truffle Cake']), const PaymentSection());
      expect(
        find.text('Cash on Delivery isn\'t available for Truffle Cake. Please pay online.'),
        findsOneWidget,
      );
      expect(find.text(CheckoutStrings.payCod), findsNothing);
    });
  });
}
