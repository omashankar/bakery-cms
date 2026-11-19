abstract final class CartStrings {
  static const String title = 'Your cart';
  static const String emptyTitle = 'Your cart is empty';
  static const String emptyMessage = 'Add a cake or a gift and it will wait for you here.';
  static const String startShopping = 'Start shopping';
  static const String subtotal = 'Subtotal';
  static const String itemsSuffix = 'items';
  static const String itemSuffix = 'item';
  static const String pricedAtCheckout =
      'Delivery, taxes and offers are worked out by the shop at checkout.';
  static const String checkout = 'Checkout';
  static const String remove = 'Remove';
  static const String removeTitle = 'Remove item?';
  static const String removeMessage = 'This item will be taken out of your cart.';
  static const String messagePrefix = 'Message:';
  static const String photoAdded = 'Photo added';
  static const String photoToPrint = 'Your photo, to be printed on it';
  static const String moveToWishlist = 'Move to wishlist';
  static const String movedToWishlist = 'Moved to wishlist';
  static const String alreadyInWishlist = 'Removed from cart — it was already in your wishlist';
  static const String proceedToCheckout = 'Proceed to checkout';
  static const String signInToCheckout = 'Sign in to checkout';

  static const String undo = 'Undo';
  static const String restored = 'Item restored';

  /// "Removed Chocolate Truffle Cake", with Undo beside it.
  static String removed(String name) => 'Removed $name';

  /// "Shopping Cart (3)", the website's cart heading.
  static String heading(int count) => 'Shopping Cart ($count)';

  /// "Subtotal (3 items)".
  static String subtotalOf(int count) =>
      '$subtotal ($count ${count == 1 ? itemSuffix : itemsSuffix})';

  /// "(20% off)" after the struck price.
  static String percentOff(int percent) => '($percent% off)';

  /// "₹799 each", under a line of more than one.
  static String each(String price) => '$price each';

  /// "You save ₹600".
  static String youSave(String amount) => 'You save $amount';

  // A line's choices, labelled (the website's `cartLineChoices`).
  static const String sizeLabel = 'Size';
  static const String flavourLabel = 'Flavour';
  static const String shapeLabel = 'Shape';

  /// "Delivery: 2026-11-20 · 6:00 PM – 8:00 PM", as the website's cart says it.
  static String deliveryOn(String date, String? time) =>
      'Delivery: $date${time == null || time.trim().isEmpty ? '' : ' · $time'}';
}
