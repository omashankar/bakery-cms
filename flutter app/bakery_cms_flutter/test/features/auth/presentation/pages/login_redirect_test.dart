import 'dart:async';

import 'package:bakery_cms_flutter/app/router/app_routes.dart';
import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_event.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_state.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/login_bloc.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/login_event.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/login_state.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/pages/login_page.dart';
import 'package:bakery_cms_flutter/features/auth/domain/entities/customer.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get_it/get_it.dart';
import 'package:go_router/go_router.dart';

class _MockAuthBloc extends MockBloc<AuthEvent, AuthState> implements AuthBloc {}

class _MockLoginBloc extends MockBloc<LoginEvent, LoginState> implements LoginBloc {}

/// Found in review: Cart → Checkout PUSHES the sign-in page over /cart. After
/// a valid code the router saw /cart unchanged, so nothing moved and the
/// customer was left on the sign-in page with the button spinning.
void main() {
  const customer = Customer(id: 'c', email: 'riya@example.com', name: 'Riya', phone: '');
  late _MockAuthBloc auth;
  late StreamController<AuthState> authStates;

  setUp(() {
    auth = _MockAuthBloc();
    authStates = StreamController<AuthState>();
    whenListen(auth, authStates.stream, initialState: const AuthState.unauthenticated());

    final login = _MockLoginBloc();
    whenListen(login, const Stream<LoginState>.empty(), initialState: const LoginState());
    GetIt.I.registerFactory<LoginBloc>(() => login);
  });

  tearDown(() async {
    await authStates.close();
    await GetIt.I.reset();
  });

  Future<GoRouter> pumpApp(WidgetTester tester) async {
    final router = GoRouter(
      initialLocation: AppRoutes.cart,
      routes: [
        GoRoute(
          path: AppRoutes.cart,
          builder: (context, _) => Scaffold(
            body: TextButton(
              // What the guard turns a signed-out Checkout tap into.
              onPressed: () => context.push(AppRoutes.loginThen(AppRoutes.checkout)),
              child: const Text('CART'),
            ),
          ),
        ),
        GoRoute(
          path: AppRoutes.login,
          builder: (_, state) => LoginPage(redirectTo: state.uri.queryParameters['from']),
        ),
        GoRoute(
          path: AppRoutes.checkout,
          builder: (_, _) => const Scaffold(body: Text('CHECKOUT')),
        ),
      ],
    );
    await tester.pumpWidget(
      BlocProvider<AuthBloc>.value(
        value: auth,
        child: MaterialApp.router(theme: AppTheme.light, routerConfig: router),
      ),
    );
    return router;
  }

  testWidgets('signing in from a pushed sign-in page goes on to checkout', (tester) async {
    final router = await pumpApp(tester);
    await tester.tap(find.text('CART'));
    await tester.pumpAndSettle();
    expect(find.byType(LoginPage), findsOneWidget);

    authStates.add(const AuthState.authenticated(customer));
    await tester.pumpAndSettle();

    expect(find.text('CHECKOUT'), findsOneWidget);
    expect(find.byType(LoginPage), findsNothing);

    // Back from checkout returns to the cart, not to the sign-in page.
    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('CART'), findsOneWidget);
  });

  testWidgets('an off-site "from" is ignored', (tester) async {
    final router = await pumpApp(tester);
    router.go(
      Uri(path: AppRoutes.login, queryParameters: {'from': 'https://evil.test'}).toString(),
    );
    await tester.pumpAndSettle();

    authStates.add(const AuthState.authenticated(customer));
    await tester.pumpAndSettle();

    expect(router.routerDelegate.currentConfiguration.uri.path, AppRoutes.home);
  });
}
