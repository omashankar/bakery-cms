import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/shop_contact.dart';
import 'opening_hours_model.dart';

part 'shop_contact_model.g.dart';

/// `GET /api/storefront/contact`: `getStorefrontContact()`, the same answer
/// /store/contact and /store/faq render. `{address, phone, email,
/// mapEmbedUrl, businessHours: [{day, hours}]}`; the map is not drawn in the
/// app, so it is not read.
@JsonSerializable(createToJson: false)
class ShopContactModel {
  const ShopContactModel({
    required this.address,
    required this.phone,
    required this.email,
    required this.businessHours,
  });

  factory ShopContactModel.fromJson(Map<String, dynamic> json) => _$ShopContactModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String address;
  @JsonKey(fromJson: JsonReaders.string)
  final String phone;
  @JsonKey(fromJson: JsonReaders.string)
  final String email;
  @JsonKey(fromJson: _hours)
  final List<OpeningHoursModel> businessHours;

  static List<OpeningHoursModel> _hours(Object? value) => value is List
      ? value.whereType<Map<String, dynamic>>().map(OpeningHoursModel.fromJson).toList()
      : const [];

  ShopContact toEntity() => ShopContact(
    address: address.trim(),
    phone: phone.trim(),
    email: email.trim(),
    // A row with neither a day nor hours draws an empty line on the
    // website; here it is simply not drawn.
    openingHours: businessHours
        .map((row) => row.toEntity())
        .where((row) => row.day.isNotEmpty || row.hours.isNotEmpty)
        .toList(),
  );
}
