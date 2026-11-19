import 'package:json_annotation/json_annotation.dart';

import '../../../checkout/domain/entities/address_label.dart';
import '../../domain/entities/saved_address.dart';

part 'saved_address_model.g.dart';

/// One entry of `GET`/`PUT /api/customer-auth/addresses`, both ways.
///
/// Every field the shop stores is read AND written back, even the ones the
/// app does not edit (`country`, `altPhone`): the book is replaced whole, so
/// a field left out here would be deleted from the customer's account.
@JsonSerializable(includeIfNull: false)
class SavedAddressModel {
  const SavedAddressModel({
    required this.id,
    required this.label,
    required this.isDefault,
    required this.createdAt,
    required this.updatedAt,
    required this.fullName,
    required this.email,
    required this.phone,
    required this.addressLine1,
    required this.city,
    required this.state,
    required this.pincode,
    this.addressLine2,
    this.landmark,
    this.country,
    this.altPhone,
    this.addressLabel,
  });

  factory SavedAddressModel.fromJson(Map<String, dynamic> json) =>
      _$SavedAddressModelFromJson(json);

  factory SavedAddressModel.fromEntity(SavedAddress address) => SavedAddressModel(
        id: address.id,
        label: address.label.trim().isEmpty ? address.kind.apiValue : address.label.trim(),
        isDefault: address.isDefault,
        createdAt: _stamp(address.createdAt),
        updatedAt: _stamp(address.updatedAt),
        fullName: address.fullName.trim(),
        email: address.email.trim(),
        phone: address.phone.trim(),
        addressLine1: address.addressLine1.trim(),
        addressLine2: _optional(address.addressLine2),
        landmark: _optional(address.landmark),
        city: address.city.trim(),
        state: address.state.trim(),
        pincode: address.pincode.trim(),
        country: _optional(address.country),
        altPhone: _optional(address.altPhone),
        addressLabel: address.kind.apiValue,
      );

  @JsonKey(fromJson: _text)
  final String id;
  @JsonKey(fromJson: _text)
  final String label;
  @JsonKey(fromJson: _flag)
  final bool isDefault;
  @JsonKey(fromJson: _text)
  final String createdAt;
  @JsonKey(fromJson: _text)
  final String updatedAt;
  @JsonKey(fromJson: _text)
  final String fullName;
  @JsonKey(fromJson: _text)
  final String email;
  @JsonKey(fromJson: _text)
  final String phone;
  @JsonKey(fromJson: _text)
  final String addressLine1;
  @JsonKey(fromJson: _textOrNull)
  final String? addressLine2;
  @JsonKey(fromJson: _textOrNull)
  final String? landmark;
  @JsonKey(fromJson: _text)
  final String city;
  @JsonKey(fromJson: _text)
  final String state;
  @JsonKey(fromJson: _text)
  final String pincode;
  @JsonKey(fromJson: _textOrNull)
  final String? country;
  @JsonKey(fromJson: _textOrNull)
  final String? altPhone;
  @JsonKey(fromJson: _textOrNull)
  final String? addressLabel;

  Map<String, dynamic> toJson() => _$SavedAddressModelToJson(this);

  SavedAddress toEntity() => SavedAddress(
        id: id,
        label: label,
        isDefault: isDefault,
        createdAt: DateTime.tryParse(createdAt),
        updatedAt: DateTime.tryParse(updatedAt),
        fullName: fullName,
        email: email,
        phone: phone,
        addressLine1: addressLine1,
        addressLine2: addressLine2 ?? '',
        landmark: landmark ?? '',
        city: city,
        state: state,
        pincode: pincode,
        kind: _kindOf(addressLabel ?? label),
        country: country,
        altPhone: altPhone,
      );

  static String _text(Object? value) => value is String ? value : '';

  static String? _textOrNull(Object? value) => value is String ? value : null;

  static bool _flag(Object? value) => value == true;

  static String? _optional(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }

  /// The website's own format (`toISOString`), so its sort agrees with ours.
  static String _stamp(DateTime? value) => value?.toUtc().toIso8601String() ?? '';

  static AddressLabel _kindOf(String value) {
    final wanted = value.trim().toLowerCase();
    for (final kind in AddressLabel.values) {
      if (kind.apiValue.toLowerCase() == wanted) return kind;
    }
    return AddressLabel.home;
  }
}
