import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/presentation/pages/account_page.dart';
import '../../features/addresses/presentation/pages/address_book_page.dart';
import '../../features/auth/presentation/bloc/auth_bloc.dart';
import '../../features/auth/presentation/pages/login_page.dart';
import '../../features/cart/presentation/pages/cart_page.dart';
import '../../features/catalog/domain/entities/group_kind.dart';
import '../../features/catalog/presentation/pages/categories_page.dart';
import '../../features/catalog/presentation/pages/home_page.dart';
import '../../features/catalog/presentation/pages/product_detail_page.dart';
import '../../features/catalog/presentation/pages/product_list_page.dart';
import '../../features/catalog/presentation/pages/search_page.dart';
import '../../features/checkout/domain/entities/geo_point.dart';
import '../../features/checkout/presentation/pages/checkout_page.dart';
import '../../features/checkout/presentation/pages/map_picker_page.dart';
import '../../features/checkout/presentation/pages/order_success_page.dart';
import '../../features/orders/presentation/pages/order_detail_page.dart';
import '../../features/orders/presentation/pages/orders_page.dart';
import '../../features/support/presentation/pages/contact_page.dart';
import '../../features/support/presentation/pages/faq_page.dart';
import '../../features/support/presentation/pages/shop_page_page.dart';
import '../../features/wishlist/presentation/pages/wishlist_page.dart';
import '../view/main_shell.dart';
import '../view/not_found_page.dart';
import 'app_routes.dart';
import 'auth_redirect.dart';
import 'auth_refresh_listenable.dart';

/// The route table. Five tabs share a bottom bar (each keeps its own stack);
/// product, search, sign-in and checkout open full screen above it.
abstract final class AppRouter {
  static final GlobalKey<NavigatorState> _rootKey = GlobalKey<NavigatorState>();

  static GoRouter create(AuthBloc authBloc) {
    return GoRouter(
      navigatorKey: _rootKey,
      initialLocation: AppRoutes.home,
      refreshListenable: AuthRefreshListenable(authBloc),
      redirect: (_, state) => AuthRedirect.resolve(status: authBloc.state.status, state: state),
      errorBuilder: (_, _) => const NotFoundPage(),
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (_, _, shell) => MainShell(navigationShell: shell),
          branches: [
            StatefulShellBranch(routes: [
              GoRoute(path: AppRoutes.home, builder: (_, _) => const HomePage()),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(path: AppRoutes.categories, builder: (_, _) => const CategoriesPage()),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(path: AppRoutes.cart, builder: (_, _) => const CartPage()),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: AppRoutes.orders,
                builder: (_, _) => const OrdersPage(),
                routes: [
                  GoRoute(
                    path: ':orderNumber',
                    builder: (_, state) =>
                        OrderDetailPage(orderNumber: state.pathParameters['orderNumber']!),
                  ),
                ],
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: AppRoutes.account,
                builder: (_, _) => const AccountPage(),
                routes: [
                  // Under the account tab, so it is guarded with it
                  // (`requiresSignIn` covers every `/account/...` path).
                  GoRoute(path: 'addresses', builder: (_, _) => const AddressBookPage()),
                ],
              ),
            ]),
          ],
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.search,
          builder: (_, state) => SearchPage(initialQuery: state.uri.queryParameters['q'] ?? ''),
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.productPattern,
          builder: (_, state) => ProductDetailPage(slug: state.pathParameters['slug']!),
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.groupPattern,
          builder: (_, state) {
            final kind = GroupKind.fromPath(state.pathParameters['kind']);
            if (kind == null) return const NotFoundPage();
            return ProductListPage(kind: kind, slug: state.pathParameters['slug']!);
          },
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.wishlist,
          builder: (_, _) => const WishlistPage(),
        ),
        // Help & support: public, full screen, reachable from Account, from
        // each other, and (the pages) from the sign-in terms line.
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.contact,
          builder: (_, _) => const ContactPage(),
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.faq,
          builder: (_, _) => const FaqPage(),
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.pagePattern,
          builder: (_, state) => ShopPagePage(slug: state.pathParameters['slug']!),
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.login,
          builder: (_, state) =>
              LoginPage(redirectTo: state.uri.queryParameters[AuthRedirect.fromParam]),
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.checkout,
          builder: (_, _) => const CheckoutPage(),
          routes: [
            GoRoute(
              path: 'map',
              builder: (_, state) => MapPickerPage(initial: state.extra as GeoPoint?),
            ),
          ],
        ),
        GoRoute(
          parentNavigatorKey: _rootKey,
          path: AppRoutes.orderSuccessPattern,
          builder: (_, state) =>
              OrderSuccessPage(orderNumber: state.pathParameters['orderNumber']!),
        ),
      ],
    );
  }
}
