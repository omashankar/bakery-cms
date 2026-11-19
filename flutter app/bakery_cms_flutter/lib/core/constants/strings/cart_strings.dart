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

  // A line's choices, labelled (the website's `cartLineChoices`).
  static const String sizeLabel = 'Size';
  static const String flavourLabel = 'Flavour';
  static const String shapeLabel = 'Shape';

  /// "Delivery: 2026-11-20 · 6:00 PM – 8:00 PM", as the website's cart says it.
  static String deliveryOn(String date, String? time) =>
      'Delivery: $date${time == null || time.trim().isEmpty ? '' : ' · $time'}';
}
