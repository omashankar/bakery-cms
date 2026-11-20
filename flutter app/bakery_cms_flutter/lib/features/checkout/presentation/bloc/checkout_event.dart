import 'package:equatable/equatable.dart';

import '../../../addresses/domain/entities/saved_address.dart';
import '../../../auth/domain/entities/customer.dart';
import '../../../cart/domain/entities/cart.dart';
import '../../../store/domain/entities/store_config.dart';
import '../../domain/entities/address_field.dart';
import '../../domain/entities/address_label.dart';
import '../../domain/entities/checkout_catalog.dart';
import '../../domain/entities/geo_point.dart';
import '../../domain/entities/payment_method.dart';

sealed class CheckoutEvent extends Equatable {
  const CheckoutEvent();

  @override
  List<Object?> get props => const [];
}

/// The page opened with this cart, shop and (signed-in) customer.
final class CheckoutStarted extends CheckoutEvent {
  const CheckoutStarted({
    required this.cart,
    required this.config,
    this.customer,
    this.deliveryPincode,
  });

  final Cart cart;
  final StoreConfig config;
  final Customer? customer;

  /// The delivery PIN code the customer chose on this device (the home
  /// page's delivery line). The weakest source for the PIN field: a saved
  /// address replaces it, and it never replaces anything typed.
  final String? deliveryPincode;

  @override
  List<Object?> get props => [cart, config, customer, deliveryPincode];
}

final class CheckoutAddressFieldChanged extends CheckoutEvent {
  const CheckoutAddressFieldChanged(this.field, this.value);

  final AddressField field;
  final String value;

  @override
  List<Object?> get props => [field, value];
}

final class CheckoutAddressLabelChanged extends CheckoutEvent {
  const CheckoutAddressLabelChanged(this.label);

  final AddressLabel label;

  @override
  List<Object?> get props => [label];
}

final class CheckoutLocationPicked extends CheckoutEvent {
  const CheckoutLocationPicked(this.location);

  final GeoPoint location;

  @override
  List<Object?> get props => [location];
}

final class CheckoutTierSelected extends CheckoutEvent {
  const CheckoutTierSelected(this.tierId);

  final String tierId;

  @override
  List<Object?> get props => [tierId];
}

final class CheckoutDateSelected extends CheckoutEvent {
  const CheckoutDateSelected(this.date);

  final DateTime date;

  @override
  List<Object?> get props => [date];
}

final class CheckoutSlotSelected extends CheckoutEvent {
  const CheckoutSlotSelected(this.timeSlot);

  final String timeSlot;

  @override
  List<Object?> get props => [timeSlot];
}

final class CheckoutGiftWrapToggled extends CheckoutEvent {
  const CheckoutGiftWrapToggled(this.enabled);

  final bool enabled;

  @override
  List<Object?> get props => [enabled];
}

final class CheckoutCouponApplied extends CheckoutEvent {
  const CheckoutCouponApplied(this.code);

  final String code;

  @override
  List<Object?> get props => [code];
}

final class CheckoutCouponRemoved extends CheckoutEvent {
  const CheckoutCouponRemoved();
}

final class CheckoutNotesChanged extends CheckoutEvent {
  const CheckoutNotesChanged(this.notes);

  final String notes;

  @override
  List<Object?> get props => [notes];
}

final class CheckoutPaymentMethodSelected extends CheckoutEvent {
  const CheckoutPaymentMethodSelected(this.method);

  final PaymentMethod method;

  @override
  List<Object?> get props => [method];
}

/// Re-price the cart for the running total. Raised by the bloc itself
/// whenever a choice that changes the price changes, and by "retry".
///
/// [afterPause] waits for typing to stop first; a newer request replaces a
/// waiting one.
final class CheckoutEstimateRequested extends CheckoutEvent {
  const CheckoutEstimateRequested({this.afterPause = false});

  final bool afterPause;

  @override
  List<Object?> get props => [afterPause];
}

/// Read the customer's saved addresses (raised by the bloc on start).
final class CheckoutAddressBookRequested extends CheckoutEvent {
  const CheckoutAddressBookRequested();
}

/// The customer picked one of their saved addresses.
final class CheckoutSavedAddressChosen extends CheckoutEvent {
  const CheckoutSavedAddressChosen(this.address);

  final SavedAddress address;

  @override
  List<Object?> get props => [address];
}

final class CheckoutPlaceOrderPressed extends CheckoutEvent {
  const CheckoutPlaceOrderPressed();
}

/// The customer tapped one of the shop's occasions; null clears it (pressing
/// the chosen one again, as on the website).
final class CheckoutOccasionSelected extends CheckoutEvent {
  const CheckoutOccasionSelected(this.occasion);

  final String? occasion;

  @override
  List<Object?> get props => [occasion];
}

/// The message for whoever opens the parcel (not the notes for the shop).
final class CheckoutGiftMessageChanged extends CheckoutEvent {
  const CheckoutGiftMessageChanged(this.message);

  final String message;

  @override
  List<Object?> get props => [message];
}

/// Who the order is from. A null part is left as it was.
final class CheckoutSenderChanged extends CheckoutEvent {
  const CheckoutSenderChanged({this.name, this.phone});

  final String? name;
  final String? phone;

  @override
  List<Object?> get props => [name, phone];
}

/// "Keep it a surprise": the sender stays off what the recipient sees.
final class CheckoutHideSenderToggled extends CheckoutEvent {
  const CheckoutHideSenderToggled(this.hidden);

  final bool hidden;

  @override
  List<Object?> get props => [hidden];
}

/// The consent tick for the shop's terms and cancellation policy.
final class CheckoutTermsToggled extends CheckoutEvent {
  const CheckoutTermsToggled(this.accepted);

  final bool accepted;

  @override
  List<Object?> get props => [accepted];
}

/// The customer pressed "Use PIN X" under the map pin: [pincode] goes into
/// the address, and the pin is checked again against it.
final class CheckoutPincodeSuggestionUsed extends CheckoutEvent {
  const CheckoutPincodeSuggestionUsed(this.pincode);

  final String pincode;

  @override
  List<Object?> get props => [pincode];
}

/// Raised by the bloc itself: what `/api/razorpay/availability` answered
/// (null: no clear answer, so "Pay online" stays on offer).
final class CheckoutOnlinePaymentAnswered extends CheckoutEvent {
  const CheckoutOnlinePaymentAnswered(this.configured);

  final bool? configured;

  @override
  List<Object?> get props => [configured];
}

/// Raised by the bloc itself: the live catalogue arrived.
final class CheckoutCatalogLoaded extends CheckoutEvent {
  const CheckoutCatalogLoaded(this.catalog);

  final CheckoutCatalog catalog;

  @override
  List<Object?> get props => [catalog];
}

/// Raised by the bloc itself: the address now holds a full PIN, so where it
/// is is looked up (once typing pauses) to fill an empty City and State.
final class CheckoutPincodePlaceRequested extends CheckoutEvent {
  const CheckoutPincodePlaceRequested(this.pincode);

  final String pincode;

  @override
  List<Object?> get props => [pincode];
}
