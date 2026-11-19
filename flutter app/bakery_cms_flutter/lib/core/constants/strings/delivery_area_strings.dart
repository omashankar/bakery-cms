/// Copy for the delivery PIN code: the line under the home app bar, the
/// sheet that sets it, and the earliest-delivery line.
abstract final class DeliveryAreaStrings {
  // The bar
  static const String deliverTo = 'Deliver to';
  static const String addPincode = 'Add delivery pincode';
  static const String placeSeparator = ' · ';
  static const String delivers = 'Delivers here';
  static const String deliversToParts = 'Delivers to parts';
  static const String notDelivered = 'Not delivered here';
  static const String checking = 'Checking…';
  static const String couldNotCheck = "Couldn't check";

  // The sheet
  static const String sheetTitle = 'Where should we deliver?';
  static const String sheetMessage = 'Enter a 6-digit PIN code to see if we deliver there.';
  static const String pincodeLabel = 'PIN code';
  static const String pincodeHint = '324002';
  static const String check = 'Check';
  static const String save = 'Save';

  // The answer
  static const String eligibleHeadline = 'We deliver here';
  static const String partlyHeadline = 'We deliver to parts of this PIN code';
  static const String partlyMessage = 'Your exact address is checked at checkout.';
  static const String outsideHeadline = "Sorry, we don't deliver here yet";
  static const String unknownHeadline = "We couldn't find this PIN code";
  static const String unknownMessage = 'Please check the 6 digits and try again.';
  static const String deliveryCharge = 'Delivery';
  static const String freeDelivery = 'Free delivery';
  static const String freeAbove = 'Free above';
  static const String priceMayVary = 'The charge may vary by address.';

  // Earliest delivery
  static const String earliestDelivery = 'Earliest delivery';
  static const String labelSeparator = ': ';
  static const String today = 'Today';
  static const String tomorrow = 'Tomorrow';
}
