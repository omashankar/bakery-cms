import 'package:bakery_cms_flutter/app/router/app_routes.dart';
import 'package:bakery_cms_flutter/app/router/auth_redirect.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/bloc/auth_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  String? decide(AuthStatus status, String path, {String? from}) => AuthRedirect.decide(
        status: status,
        path: path,
        location: path,
        from: from,
      );

  test('a signed-out visitor is sent to sign in, and back afterwards', () {
    expect(
      decide(AuthStatus.unauthenticated, AppRoutes.checkout),
      AppRoutes.loginThen(AppRoutes.checkout),
    );
    expect(
      decide(AuthStatus.unauthenticated, AppRoutes.orderDetail('BK-1')),
      AppRoutes.loginThen(AppRoutes.orderDetail('BK-1')),
    );
  });

  test('public screens never redirect', () {
    for (final path in [AppRoutes.home, AppRoutes.cart, AppRoutes.product('x'), AppRoutes.orderSuccess('BK-1')]) {
      expect(decide(AuthStatus.unauthenticated, path), isNull, reason: path);
    }
  });

  test('signing in on /login returns to where they were going', () {
    expect(decide(AuthStatus.authenticated, AppRoutes.login, from: AppRoutes.checkout), AppRoutes.checkout);
    expect(decide(AuthStatus.authenticated, AppRoutes.login), AppRoutes.home);
  });

  test('an off-site "from" is ignored', () {
    expect(decide(AuthStatus.authenticated, AppRoutes.login, from: 'https://evil.example'), AppRoutes.home);
  });

  test('nothing is decided while the session is still being checked', () {
    expect(decide(AuthStatus.unknown, AppRoutes.checkout), isNull);
  });
}
