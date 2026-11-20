import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/app_routes.dart';

/// Opens an app route from a home section: a bottom tab is switched to, any
/// other screen is pushed so Back returns to the home page.
abstract final class LinkOpener {
  static const Set<String> _tabs = {
    AppRoutes.home,
    AppRoutes.categories,
    AppRoutes.cart,
    AppRoutes.orders,
    AppRoutes.account,
  };

  static void open(BuildContext context, String route) {
    if (_tabs.contains(route)) {
      context.go(route);
    } else {
      context.push(route);
    }
  }
}
