/// Every path in the app, in one place. Pages navigate with these, never with
/// a typed string.
abstract final class AppRoutes {
  // Bottom-navigation tabs
  static const String home = '/';
  static const String categories = '/categories';
  static const String cart = '/cart';
  static const String orders = '/orders';
  static const String account = '/account';

  // Account
  static const String addresses = '/account/addresses';

  // Catalog
  static const String search = '/search';
  static const String productPattern = '/product/:slug';
  static const String groupPattern = '/shop/:kind/:slug';

  // Wishlist (on the phone, so it needs no sign-in)
  static const String wishlist = '/wishlist';

  // Help & support (public, like the website's /store/contact, /store/faq
  // and /store/pages/[slug])
  static const String contact = '/contact';
  static const String faq = '/faq';
  static const String pagePattern = '/pages/:slug';

  // Sign-in
  static const String login = '/login';

  // Checkout
  static const String checkout = '/checkout';
  static const String mapPicker = '/checkout/map';
  static const String orderSuccessPattern = '/order-success/:orderNumber';

  // Orders
  static const String orderDetailPattern = '/orders/:orderNumber';

  /// Screens a signed-out visitor is sent to [login] from.
  static const List<String> requiresSignIn = [checkout, orders, account];

  static String product(String slug) => '/product/${Uri.encodeComponent(slug)}';

  /// A published CMS page: `page('privacy')`, `page('terms')`.
  static String page(String slug) => '/pages/${Uri.encodeComponent(slug)}';

  /// [kind] is `category`, `occasion` or `collection`.
  static String group(String kind, String slug) =>
      '/shop/$kind/${Uri.encodeComponent(slug)}';

  static String searchFor(String query) =>
      Uri(path: search, queryParameters: {'q': query}).toString();

  static String orderSuccess(String orderNumber) =>
      '/order-success/${Uri.encodeComponent(orderNumber)}';

  static String orderDetail(String orderNumber) =>
      '/orders/${Uri.encodeComponent(orderNumber)}';

  /// The sign-in page, returning to [from] afterwards.
  static String loginThen(String from) =>
      Uri(path: login, queryParameters: {'from': from}).toString();
}
