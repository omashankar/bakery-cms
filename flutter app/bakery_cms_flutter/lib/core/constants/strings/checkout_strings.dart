/// Every word on the checkout, map picker and order-success screens.
abstract final class CheckoutStrings {
  static const String title = 'Checkout';
  static const String separator = ' · ';
  static const String minus = '− ';
  static const String emptyCartTitle = 'Your cart is empty';
  static const String emptyCartMessage = 'Add something delicious before checking out.';
  static const String browseProducts = 'Browse products';
  static const String loadingShop = 'Loading the shop\'s delivery options…';

  // Contact & address
  static const String sectionAddress = 'Contact & address';
  static const String fullName = 'Full name';
  static const String email = 'Email';
  static const String phone = 'Mobile number';
  static const String addressLine1 = 'House / flat, street';
  static const String addressLine2 = 'Area, colony (optional)';
  static const String landmark = 'Landmark (optional)';
  static const String city = 'City';
  static const String state = 'State';
  static const String pincode = 'PIN code';
  static const String altPhone = 'Alternate phone (optional)';
  static const String country = 'Country (optional)';
  static const String labelHome = 'Home';
  static const String labelOffice = 'Office';
  static const String labelOther = 'Other';

  // Delivery location
  static const String sectionLocation = 'Delivery location';
  static const String locationHelp = 'Drop a pin on your door so we can confirm we deliver there.';
  static const String pickOnMap = 'Pick on map';
  static const String changePin = 'Change pin';
  static const String checkingPin = 'Checking this location…';
  static const String pinEligible = 'We deliver here';
  static const String pinOutside = 'Sorry, this location is outside our delivery areas.';
  static const String pinRefused = 'We could not confirm this location.';
  static const String pinDeliveryCharge = 'Delivery charge';

  // What the shop said about the pin (the website's delivery-pin-picker.tsx).
  static const String mapShowsHere = 'The map shows here: ';
  static const String pinIsNear = 'Pin is near';
  static const String pinAt = 'Pin at';
  static String usePincode(String pincode) => 'Use PIN $pincode';
  static const String use = 'Use';
  static const String notYourPinUse = 'Not your PIN? Use';

  /// "PIN code here (nearest post office): 324001 · your address says 324002"
  static String pincodeHere(String atPin, String typed) =>
      'PIN code here (nearest post office): $atPin'
      '${typed.isNotEmpty && typed != atPin ? ' · your address says $typed' : ''}';
  static String noPincodeHere(String typed) => typed.isEmpty
      ? 'We couldn\'t find a PIN code for this spot. Please type your PIN code above.'
      : 'We couldn\'t find a PIN code for this spot. Please check that $typed is right for your address.';

  /// "About 4 km from where we deliver…": under 1 km reads as 1, as on the
  /// website. The app's map draws no areas, so it does not say "shaded".
  static String kmFromArea(double km) =>
      'About ${km < 1 ? 1 : km.round()} km from where we deliver. '
      'If this is not where you are, move the pin to your door.';

  // Delivery
  static const String sectionDelivery = 'Delivery';
  static const String deliverySpeed = 'Delivery speed';
  static const String deliveryDate = 'Delivery date';
  static const String deliveryTime = 'Delivery time';
  static const String free = 'Free';
  static const String noWindowsToday =
      'No delivery windows are left for this day. Please pick another date.';
  static const String noTiers =
      'These items cannot be delivered together. Please order them separately.';

  // Extras
  static const String sectionExtras = 'Extras';
  static const String coupon = 'Coupon code';
  static const String applyCoupon = 'Apply';
  static const String removeCoupon = 'Remove coupon';
  static const String couponRejected = 'This coupon cannot be used on this order.';
  static const String couponApplied = 'Coupon applied';
  static const String orderNotes = 'Notes for the bakery (optional)';

  // Payment
  static const String sectionPayment = 'Payment';
  static const String payCod = 'Cash on delivery';
  static const String payCodHint = 'Pay when your order arrives';
  static const String payOnline = 'Pay online';
  static const String payOnlineHint = 'UPI, cards, net banking and wallets';
  static const String noPaymentMethod =
      'No payment method is available for this order. Please contact the shop.';

  /// Why there is no cash option, rather than a method that silently vanished.
  static String codUnavailableFor(List<String> names) =>
      'Cash on Delivery isn\'t available for ${names.toSet().join(', ')}. Please pay online.';

  // Personalise this gift (the website's Personalize step)
  static const String sectionPersonalise = 'Personalise this gift';
  static const String occasion = 'Occasion (optional)';
  static const String giftMessage = 'Message for the recipient (optional)';
  static const String senderTitle = 'Who it is from (optional)';
  static const String senderPromise = 'We will use these to reach you about this order.';
  static const String senderNotSet = 'Not set';
  static const String senderName = 'Name';
  static const String senderPhone = 'Phone';
  static const String edit = 'Edit';
  static const String done = 'Done';
  static const String keepSurprise = 'Keep it a surprise';
  static const String keepSurpriseHint = 'Your name and number stay off what the recipient sees.';
  static const String keepSurpriseShopHas =
      ' The shop still has them, because it has to be able to reach you.';

  // Consent and the cancellation policy
  static const String cancellationPolicy = 'Cancellation policy';
  static const String readFullPolicy = 'Read the full policy';
  static const String policyAgreedByTick = 'Ticking the box below also agrees to this policy.';
  static const String defaultTerms = 'I agree to the Terms of Service.';
  static const String acceptTerms = 'Accept the terms above to continue';

  /// The website's minimum-order refusal and its alert.
  static String minimumOrder(String amount) => 'Minimum order value is $amount';
  static String minimumOrderAlert(String amount) =>
      'Minimum order value is $amount. Add more items to continue.';

  // Summary
  static const String sectionSummary = 'Price details';
  static const String subtotal = 'Subtotal';
  static const String deliveryFee = 'Delivery';
  static const String speedFee = 'Delivery speed';
  static const String giftWrapFee = 'Gift wrap';
  static const String platformFee = 'Platform fee';
  static const String tax = 'Tax';
  static const String discount = 'Discount';
  static const String total = 'Total';
  static const String calculating = 'Updating prices…';
  static const String estimateFailed = 'Could not update the prices.';
  static const String placeOrder = 'Place order';
  static const String payAndPlaceOrder = 'Pay';

  // Refusals the bloc raises itself
  static const String fixHighlighted = 'Please fix the highlighted fields.';
  static const String needPin = 'Please drop a pin on the map for your delivery location.';
  static const String pinNotEligible = 'We do not deliver to the pinned location.';
  static const String needTier = 'Please choose a delivery speed.';
  static const String needDate = 'Please choose a delivery date.';
  static const String needSlot = 'Please choose a delivery time.';
  static const String needPaymentMethod = 'Please choose how you would like to pay.';
  static const String incompleteAddress = 'Please complete your contact details and address.';

  // Payment outcomes
  static const String paymentCancelled = 'Payment was cancelled. Your order has not been placed.';
  static const String paymentFailed =
      'The payment did not go through. No money was taken. Please try again.';
  static const String paymentUnavailable =
      'Online payment is not available on this device. Please choose cash on delivery.';
  static const String paymentDescription = 'Order payment';
  static const String paidTitle = 'Payment received';

  /// Paid, but the confirmation never came back.
  static String paidButUnconfirmedFor(String paymentId) =>
      'Your payment went through (payment id $paymentId), but we could not confirm '
      'the order yet. It will appear in My Orders shortly. Please do not pay again.';

  /// Paid, and then the shop refused the order.
  static String paidButRefused(String paymentId) =>
      'Your payment went through (payment id $paymentId), but the shop could not '
      'accept the order. Please contact the shop with this payment id; do not pay again.';

  // Price changed at Place order
  static const String priceChangedCoupon =
      'This coupon can no longer be used on this order, so the price changed.';
  static const String priceChangedTotal = 'The price changed after checking your delivery address.';
  static const String priceNotShown = 'Please check the total before placing the order.';
  static const String newTotalPrefix = 'New total: ';
  static const String confirmPriceSuffix = '. Press Place order again to confirm.';

  // Coupon states
  static const String couponChecking = 'Checking coupon';
  static const String couponNotChecked = 'Could not check this code. Please apply it again.';

  // Location
  static const String mapTitle = 'Pick delivery location';
  static const String mapHint = 'Move the map or tap to place the pin on your door.';
  static const String useMyLocation = 'Use my current location';
  static const String confirmLocation = 'Confirm location';
  static const String mapAttribution = 'OpenStreetMap contributors';
  static const String locationServiceOff =
      'Location is turned off. Turn it on, or move the map to your address.';
  static const String locationDenied =
      'Location permission was not given. You can still move the map to your address.';
  static const String locationDeniedForever =
      'Location permission is blocked. Allow it in Settings, or move the map to your address.';
  static const String locationUnavailable =
      'Could not find your location. Please move the map to your address.';

  // Success
  static const String successTitle = 'Order placed!';
  static const String successMessage =
      'Thank you. We have emailed your confirmation and will start preparing your order.';
  static const String orderNumberLabel = 'Order number';
  static const String viewOrder = 'View order';
  static const String continueShopping = 'Continue shopping';
}
