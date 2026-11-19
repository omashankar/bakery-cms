import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/bloc/auth_status.dart';
import 'app_routes.dart';

/// Where to send someone, given whether they are signed in. Pure, so it is
/// unit-tested without a router.
abstract final class AuthRedirect {
  static const String fromParam = 'from';

  static String? resolve({required AuthStatus status, required GoRouterState state}) =>
      decide(
        status: status,
        path: state.matchedLocation,
        location: state.uri.toString(),
        from: state.uri.queryParameters[fromParam],
      );

  static String? decide({
    required AuthStatus status,
    required String path,
    required String location,
    String? from,
  }) {
    // Still asking the shop who this is: decide once it answers.
    if (status == AuthStatus.unknown) return null;

    final signedIn = status == AuthStatus.authenticated;
    if (!signedIn && _needsSignIn(path)) return AppRoutes.loginThen(location);
    if (signedIn && path == AppRoutes.login) {
      return (from != null && from.startsWith('/')) ? from : AppRoutes.home;
    }
    return null;
  }

  static bool _needsSignIn(String path) => AppRoutes.requiresSignIn.any(
        (guarded) => path == guarded || path.startsWith('$guarded/'),
      );
}
