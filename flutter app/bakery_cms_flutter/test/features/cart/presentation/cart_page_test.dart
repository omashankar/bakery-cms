import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/cart_strings.dart';
import 'package:bakery_cms_flutter/core/constants/strings/checkout_strings.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_event.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_state.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_cubit.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_state.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/pages/cart_page.dart';
import 'package:bakery_cms_flutter/features/checkout/presentation/widgets/checkout_progress.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import '../../catalog/app_cubits_harness.dart';

class _MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

class _MockCartCubit extends MockCubit<CartState> implements CartCubit {}

const _truffle = CartItem(
  id: 'truffle-1kg',
  productSlug: 'chocolate-truffle-cake',
  name: 'Chocolate Truffle Cake',
  image: '',
  unitPrice: 800,
  compareAtPrice: 1000,
  quantity: 2,
  weight: '1 Kg',
);

const _pastry = CartItem(
  id: 'pastry',
  productSlug: 'red-velvet-pastry',
  name: 'Red Velvet Pastry',
  image: '',
  unitPrice: 150,
  quantity: 1,
);

void main() {
  setUpAll(() => registerFallbackValue(_pastry));

  late _MockCartCubit cart;
  late _MockAuthBloc auth;

  setUp(() {
    cart = _MockCartCubit();
    auth = _MockAuthBloc();
    when(() => auth.state).thenReturn(const AuthState.unauthenticated());
    when(() => cart.remove(any())).thenAnswer((_) async {});
    when(() => cart.add(any(), announce: any(named: 'announce'))).thenAnswer((_) async {});
  });

  Future<void> pumpCart(
    WidgetTester tester,
    Cart lines, {
    List<String> saved = const [],
    double width = 400,
  }) async {
    when(() => cart.state).thenReturn(CartState(status: ViewStatus.success, cart: lines));
    tester.view
      ..physicalSize = Size(width, 2000)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      withAppCubits(
        saved: saved,
        MultiBlocProvider(
          providers: [
            BlocProvider<CartCubit>.value(value: cart),
            BlocProvider<AuthBloc>.value(value: auth),
          ],
          child: MaterialApp(theme: AppTheme.light, home: const CartPage()),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('the steps, at Cart; the heading counts the items', (tester) async {
    await pumpCart(tester, const Cart([_truffle, _pastry]));

    final progress = tester.widget<CheckoutProgress>(find.byType(CheckoutProgress));
    expect(progress.current.label, CheckoutStrings.stepCart);
    for (final step in [
      CheckoutStrings.stepCart,
      CheckoutStrings.stepAddress,
      CheckoutStrings.stepPersonalise,
      CheckoutStrings.stepPayment,
    ]) {
      expect(find.text(step), findsOneWidget);
    }
    expect(find.text(CartStrings.heading(3)), findsOneWidget);
  });

  testWidgets("a line: its total, the shop's struck price with what it takes off, and each", (
    tester,
  ) async {
    await pumpCart(tester, const Cart([_truffle]));

    expect(find.text('₹1,600'), findsWidgets); // the line, and the subtotal
    expect(find.text('₹2,000'), findsOneWidget); // 1,000 × 2, struck
    expect(find.text(CartStrings.percentOff(20)), findsOneWidget);
    expect(find.text(CartStrings.each('₹800')), findsOneWidget);
    expect(find.text(CartStrings.youSave('₹400')), findsOneWidget);
  });

  testWidgets('no compare-at: no struck price, no saving claimed', (tester) async {
    await pumpCart(tester, const Cart([_pastry]));

    expect(find.textContaining('% off'), findsNothing);
    expect(find.textContaining('You save'), findsNothing);
    expect(find.textContaining('each'), findsNothing);
  });

  testWidgets("the button runs to the bar's end, no empty gap beside it", (tester) async {
    // Wide enough that the amount is narrower than a third of the bar, as
    // it is on a phone with real letters (the test font's are a full em).
    await pumpCart(tester, const Cart([_pastry]), width: 800);
    // 16 of padding: the button ends at 784, as the amount starts at 16. A
    // flex share held for the amount left it ending well short.
    expect(tester.getTopRight(find.byType(FilledButton)).dx, closeTo(784, 0.5));
  });

  testWidgets('the button says it signs in first, until the customer is signed in', (tester) async {
    await pumpCart(tester, const Cart([_pastry]));
    expect(find.text(CartStrings.signInToCheckout), findsOneWidget);
    expect(find.text(CartStrings.proceedToCheckout), findsNothing);
  });

  testWidgets('Remove takes the line out at once, and Undo puts the same line back', (
    tester,
  ) async {
    await pumpCart(tester, const Cart([_truffle]));

    await tester.tap(find.text(CartStrings.remove));
    await tester.pump();
    verify(() => cart.remove(_truffle.id)).called(1);
    expect(find.text(CartStrings.removed(_truffle.name)), findsOneWidget);

    await tester.pump(const Duration(seconds: 1)); // the snackbar slides in
    await tester.tap(find.text(CartStrings.undo));
    await tester.pump();
    verify(() => cart.add(_truffle, announce: false)).called(1);
  });

  testWidgets('Move to wishlist saves it and takes it out of the cart', (tester) async {
    await pumpCart(tester, const Cart([_pastry]));

    await tester.tap(find.text(CartStrings.moveToWishlist));
    await tester.pump();
    final wishlist = tester.element(find.byType(CartPage)).read<WishlistCubit>();
    verify(() => wishlist.toggle(_pastry.productSlug)).called(1);
    verify(() => cart.remove(_pastry.id)).called(1);
    expect(find.text(CartStrings.movedToWishlist), findsOneWidget);
  });

  testWidgets('already in the wishlist: not toggled OUT of it, and it says so', (tester) async {
    await pumpCart(tester, const Cart([_pastry]), saved: [_pastry.productSlug]);

    await tester.tap(find.text(CartStrings.moveToWishlist));
    await tester.pump();
    final wishlist = tester.element(find.byType(CartPage)).read<WishlistCubit>();
    verifyNever(() => wishlist.toggle(any()));
    verify(() => cart.remove(_pastry.id)).called(1);
    expect(find.text(CartStrings.alreadyInWishlist), findsOneWidget);
  });

  testWidgets('an empty cart: no steps over a checkout that is not happening', (tester) async {
    await pumpCart(tester, const Cart());

    expect(find.byType(CheckoutProgress), findsNothing);
    expect(find.text(CartStrings.emptyTitle), findsOneWidget);
  });

  testWidgets('nothing overflows on a 360dp phone at text scale 1.3', (tester) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    when(() => cart.state).thenReturn(
      const CartState(status: ViewStatus.success, cart: Cart([_truffle, _pastry])),
    );
    tester.view
      ..physicalSize = const Size(360, 2000)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      withAppCubits(
        MultiBlocProvider(
          providers: [
            BlocProvider<CartCubit>.value(value: cart),
            BlocProvider<AuthBloc>.value(value: auth),
          ],
          child: MaterialApp(theme: AppTheme.light, home: const CartPage()),
        ),
      ),
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
