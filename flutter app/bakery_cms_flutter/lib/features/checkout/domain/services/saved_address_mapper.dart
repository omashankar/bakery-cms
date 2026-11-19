import '../../../addresses/domain/entities/saved_address.dart';
import '../entities/checkout_address.dart';

/// Between the address book and the checkout form.
abstract final class SavedAddressMapper {
  /// The form filled from [saved]. Name, email and phone the saved address
  /// lacks are kept from [current] (the account's). The map pin is kept
  /// only when [keepLocation]: a saved address has none of its own.
  static CheckoutAddress toCheckout(
    SavedAddress saved, {
    required CheckoutAddress current,
    required bool keepLocation,
  }) {
    String or(String preferred, String fallback) =>
        preferred.trim().isEmpty ? fallback : preferred.trim();
    return CheckoutAddress(
      fullName: or(saved.fullName, current.fullName),
      email: or(saved.email, current.email),
      phone: or(saved.phone, current.phone),
      // The second number and the country travel with the address, as the
      // website's `toCheckoutAddress` carries them (checkout-page.tsx).
      altPhone: (saved.altPhone ?? '').trim(),
      addressLine1: saved.addressLine1.trim(),
      addressLine2: saved.addressLine2.trim(),
      landmark: saved.landmark.trim(),
      city: saved.city.trim(),
      state: saved.state.trim(),
      pincode: saved.pincode.trim(),
      country: (saved.country ?? '').trim(),
      label: saved.kind,
      location: keepLocation ? current.location : null,
    );
  }

  /// What the book keeps of an order's address: everything but the pin.
  static SavedAddress fromCheckout(CheckoutAddress address) => SavedAddress(
    label: address.label.apiValue,
    kind: address.label,
    fullName: address.fullName.trim(),
    email: address.email.trim(),
    phone: address.phone.trim(),
    addressLine1: address.addressLine1.trim(),
    addressLine2: address.addressLine2.trim(),
    landmark: address.landmark.trim(),
    city: address.city.trim(),
    state: address.state.trim(),
    pincode: address.pincode.trim(),
    country: _optional(address.country),
    altPhone: _optional(address.altPhone),
  );

  /// Blank is absent: the book keeps no empty country or second number.
  static String? _optional(String value) => value.trim().isEmpty ? null : value.trim();

  /// Whether the form already shows the place [saved] is.
  static bool isSamePlace(CheckoutAddress address, SavedAddress saved) =>
      fromCheckout(address).isSamePlaceAs(saved);
}
