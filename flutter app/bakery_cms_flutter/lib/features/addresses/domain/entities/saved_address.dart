import 'package:equatable/equatable.dart';

import '../../../checkout/domain/entities/address_label.dart';

/// One address in the customer's book, kept on their account so every device
/// (and the website) sees the same list.
///
/// A saved address has no map pin: the server's book does not store one, so
/// checkout still asks for the pin after filling the form from it.
class SavedAddress extends Equatable {
  const SavedAddress({
    this.id = '',
    this.label = '',
    this.isDefault = false,
    this.createdAt,
    this.updatedAt,
    this.fullName = '',
    this.email = '',
    this.phone = '',
    this.addressLine1 = '',
    this.addressLine2 = '',
    this.landmark = '',
    this.city = '',
    this.state = '',
    this.pincode = '',
    this.kind = AddressLabel.home,
    this.country,
    this.altPhone,
  });

  /// Empty until the book stores it.
  final String id;

  /// The shop's free-text `label` ("Home", or a name the website let the
  /// customer type). [kind] is the Home / Office / Other choice.
  final String label;
  final bool isDefault;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String fullName;
  final String email;
  final String phone;
  final String addressLine1;
  final String addressLine2;
  final String landmark;
  final String city;
  final String state;
  final String pincode;
  final AddressLabel kind;

  /// Optional, as on the website's address form: who else to call at the
  /// door, and the country (the website's form starts it at
  /// [defaultCountry]).
  final String? country;
  final String? altPhone;

  /// The website's new-address form starts here: "The shop delivers in India
  /// only, for now" (apps/website/account/pages/account-addresses-page.tsx).
  static const String defaultCountry = 'India';

  bool get isNew => id.isEmpty;

  /// The same place: line 1 and PIN agree, ignoring case and spacing.
  bool isSamePlaceAs(SavedAddress other) =>
      _key(addressLine1) == _key(other.addressLine1) && _key(pincode) == _key(other.pincode);

  static final RegExp _spaces = RegExp(r'\s+');

  static String _key(String value) => value.trim().toLowerCase().replaceAll(_spaces, ' ');

  SavedAddress copyWith({
    String? id,
    String? label,
    bool? isDefault,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? fullName,
    String? email,
    String? phone,
    String? addressLine1,
    String? addressLine2,
    String? landmark,
    String? city,
    String? state,
    String? pincode,
    AddressLabel? kind,
    String? country,
    String? altPhone,
  }) {
    return SavedAddress(
      id: id ?? this.id,
      label: label ?? this.label,
      isDefault: isDefault ?? this.isDefault,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      addressLine1: addressLine1 ?? this.addressLine1,
      addressLine2: addressLine2 ?? this.addressLine2,
      landmark: landmark ?? this.landmark,
      city: city ?? this.city,
      state: state ?? this.state,
      pincode: pincode ?? this.pincode,
      kind: kind ?? this.kind,
      country: country ?? this.country,
      altPhone: altPhone ?? this.altPhone,
    );
  }

  @override
  List<Object?> get props => [
    id,
    label,
    isDefault,
    createdAt,
    updatedAt,
    fullName,
    email,
    phone,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    pincode,
    kind,
    country,
    altPhone,
  ];
}
