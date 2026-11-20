import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/coupon.dart';

part 'coupon_model.g.dart';

/// One coupon from `GET /api/coupons` (`data: [...]`), the website's
/// `StoredCoupon`.
@JsonSerializable(createToJson: false)
class CouponModel {
  const CouponModel({
    required this.id,
    required this.code,
    required this.label,
    required this.description,
    required this.isActive,
    required this.categoryIds,
    this.minSubtotal,
    this.percentOff,
    this.flatOff,
    this.expiresAt,
  });

  factory CouponModel.fromJson(Map<String, dynamic> json) => _$CouponModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String code;
  @JsonKey(fromJson: JsonReaders.string)
  final String label;
  @JsonKey(fromJson: JsonReaders.string)
  final String description;
  @JsonKey(fromJson: JsonReaders.toDoubleOrNull)
  final double? minSubtotal;
  @JsonKey(fromJson: JsonReaders.toDoubleOrNull)
  final double? percentOff;
  @JsonKey(fromJson: JsonReaders.toDoubleOrNull)
  final double? flatOff;

  /// Absent means on (only live coupons are sent to a visitor anyway).
  @JsonKey(fromJson: JsonReaders.boolTrue)
  final bool isActive;
  final String? expiresAt;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> categoryIds;

  /// Null for a coupon with no code: there is nothing a customer could type.
  Coupon? toEntity() {
    final typed = code.trim();
    if (typed.isEmpty) return null;
    final expiry = (expiresAt ?? '').trim();
    final parsed = expiry.isEmpty ? null : DateTime.tryParse(expiry);
    return Coupon(
      id: id,
      code: typed,
      label: label.trim(),
      description: description.trim(),
      minSubtotal: minSubtotal,
      percentOff: percentOff,
      flatOff: flatOff,
      isActive: isActive,
      expiresAt: parsed,
      expiryUnreadable: expiry.isNotEmpty && parsed == null,
      categoryIds: categoryIds,
    );
  }
}
