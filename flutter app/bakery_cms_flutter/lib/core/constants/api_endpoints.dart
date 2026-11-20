/// Every path the app calls on the shop's Next.js backend.
///
/// The base URL comes from `--dart-define=API_BASE_URL=https://yourshop.in`.
///
/// Without it, debug builds use the local dev server at 127.0.0.1:3000.
/// On Android (a real phone or the emulator) that reaches the computer only
/// through the adb tunnel, set up once per connection:
///
///     adb reverse tcp:3000 tcp:3000
///
/// Not 10.0.2.2: that address exists only inside the emulator, and a real
/// phone timed out on it. Not the computer's Wi-Fi address: Windows Firewall
/// blocks the phone from reaching it. Not `localhost`: on Windows it is slow
/// to resolve and timed out the 15-second connect.
abstract final class ApiEndpoints {
  static const String _configured = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl => _configured.isNotEmpty ? _configured : 'http://127.0.0.1:3000';

  // Shop
  static const String publicSettings = '/api/settings/public';
  static const String catalog = '/api/catalog';
  static const String products = '/api/products';

  // Customer sign-in (email + 6-digit code, session in an httpOnly cookie)
  static const String requestCode = '/api/customer-auth/request-code';
  static const String verifyCode = '/api/customer-auth/verify';
  static const String me = '/api/customer-auth/me';
  static const String storefrontHome = '/api/storefront/home';
  static const String logout = '/api/customer-auth/logout';
  static const String myOrders = '/api/customer-auth/orders';
  static const String profile = '/api/customer-auth/profile';

  // Checkout
  static const String quote = '/api/checkout/quote';
  static const String deliveryPin = '/api/checkout/delivery-pin';

  /// India Post's PIN directory: where a PIN is (`?codes=324001`).
  static const String pincodes = '/api/pincodes';
  static const String orders = '/api/orders';
  static const String razorpayOrder = '/api/razorpay/order';
  static const String razorpayAvailability = '/api/razorpay/availability';

  static String orderCancellation(String orderNumber) =>
      '/api/customer-auth/orders/${Uri.encodeComponent(orderNumber)}/cancellation';

  /// Emails the order's own invoice to the address ON the order. The shop
  /// takes the owner's lookup (`email`) as a query, not a body
  /// (`emailInvoiceRequest` in features/orders/lib/orders-api.ts).
  static String orderInvoiceEmail(String orderNumber, {required String email}) =>
      '/api/orders/by-number/${Uri.encodeComponent(orderNumber)}/email-invoice'
      '?${Uri(queryParameters: {'email': email.trim()}).query}';
}
