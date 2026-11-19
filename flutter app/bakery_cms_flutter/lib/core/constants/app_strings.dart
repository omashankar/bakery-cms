/// Shared wording used across features. Each feature keeps its own screen
/// copy in `core/constants/strings/<feature>_strings.dart`, so no widget ever
/// holds a literal.
abstract final class AppStrings {
  static const String appName = 'Bakery';

  // Generic actions
  static const String retry = 'Try again';
  static const String cancel = 'Cancel';
  static const String ok = 'OK';
  static const String confirm = 'Confirm';
  static const String save = 'Save';
  static const String close = 'Close';
  static const String continueLabel = 'Continue';
  static const String viewAll = 'View all';
  static const String loading = 'Loading…';

  /// After a discount's number: "20% OFF".
  static const String percentOffSuffix = '% OFF';

  // Bottom navigation
  static const String navHome = 'Home';
  static const String navCategories = 'Categories';
  static const String navCart = 'Cart';
  static const String navOrders = 'Orders';
  static const String navAccount = 'Account';

  // Empty / error states
  static const String nothingHere = 'Nothing here yet';
  static const String somethingWentWrong = 'Something went wrong';

  // Failure messages — the only error text a customer ever sees.
  // Also what shows when the phone is online but the shop cannot be reached,
  // so it does not claim the customer has no internet.
  static const String errorNetwork =
      "Can't reach the shop right now. Check your internet connection and try again.";
  static const String errorTimeout = 'The shop is taking too long to answer. Please try again.';
  static const String errorServer =
      'The shop could not complete that right now. Please try again shortly.';
  static const String errorUnauthorized = 'Please sign in to continue.';
  static const String errorNotFound = 'We could not find that.';
  static const String errorCache = 'Could not read saved data on this device.';
  static const String errorUnknown = 'Something went wrong. Please try again.';
  static const String errorTooManyRequests =
      'Too many attempts. Please wait a few minutes and try again.';

  // Validation
  static const String validationRequired = 'This field is required';
  static const String validationEmail = 'Please enter a valid email';
  static const String validationPhone = 'Enter a 10-digit mobile number';
  static const String validationPincode = 'Enter a 6-digit PIN code';
  static const String validationOtp = 'Enter the 6-digit code from your email';
}
