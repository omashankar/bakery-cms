import 'package:equatable/equatable.dart';

import 'address_field.dart';
import 'address_label.dart';
import 'geo_point.dart';

/// Where the order goes and who to call. [location] is the map pin, which a
/// shop with delivery areas requires before it will price a full address.
///
/// The website's `CheckoutAddress` (`features/orders/lib/checkout-draft.ts`),
/// field for field: [altPhone] and [country] are optional there too.
class CheckoutAddress extends Equatable {
  const CheckoutAddress({
    this.fullName = '',
    this.email = '',
    this.phone = '',
    this.altPhone = '',
    this.addressLine1 = '',
    this.addressLine2 = '',
    this.landmark = '',
    this.city = '',
    this.state = '',
    this.pincode = '',
    this.country = '',
    this.label = AddressLabel.home,
    this.location,
  });

  final String fullName;
  final String email;
  final String phone;

  /// A second number to try. Optional everywhere, including on the order.
  final String altPhone;
  final String addressLine1;
  final String addressLine2;
  final String landmark;
  final String city;
  final String state;
  final String pincode;

  /// Free text and blank by default, as on the website: nothing records
  /// which country the shop is in, so the app does not assert one.
  final String country;
  final AddressLabel label;
  final GeoPoint? location;

  /// The server's bounds (`altPhone` max 20, `country` max 80).
  static const int altPhoneMaxLength = 20;
  static const int countryMaxLength = 80;

  String valueOf(AddressField field) => switch (field) {
    AddressField.fullName => fullName,
    AddressField.email => email,
    AddressField.phone => phone,
    AddressField.altPhone => altPhone,
    AddressField.addressLine1 => addressLine1,
    AddressField.addressLine2 => addressLine2,
    AddressField.landmark => landmark,
    AddressField.city => city,
    AddressField.state => state,
    AddressField.pincode => pincode,
    AddressField.country => country,
  };

  CheckoutAddress withField(AddressField field, String value) => switch (field) {
    AddressField.fullName => copyWith(fullName: value),
    AddressField.email => copyWith(email: value),
    AddressField.phone => copyWith(phone: value),
    AddressField.altPhone => copyWith(altPhone: value),
    AddressField.addressLine1 => copyWith(addressLine1: value),
    AddressField.addressLine2 => copyWith(addressLine2: value),
    AddressField.landmark => copyWith(landmark: value),
    AddressField.city => copyWith(city: value),
    AddressField.state => copyWith(state: value),
    AddressField.pincode => copyWith(pincode: value),
    AddressField.country => copyWith(country: value),
  };

  CheckoutAddress copyWith({
    String? fullName,
    String? email,
    String? phone,
    String? altPhone,
    String? addressLine1,
    String? addressLine2,
    String? landmark,
    String? city,
    String? state,
    String? pincode,
    String? country,
    AddressLabel? label,
    GeoPoint? location,
  }) {
    return CheckoutAddress(
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      altPhone: altPhone ?? this.altPhone,
      addressLine1: addressLine1 ?? this.addressLine1,
      addressLine2: addressLine2 ?? this.addressLine2,
      landmark: landmark ?? this.landmark,
      city: city ?? this.city,
      state: state ?? this.state,
      pincode: pincode ?? this.pincode,
      country: country ?? this.country,
      label: label ?? this.label,
      location: location ?? this.location,
    );
  }

  @override
  List<Object?> get props => [
    fullName,
    email,
    phone,
    altPhone,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    pincode,
    country,
    label,
    location,
  ];
}
