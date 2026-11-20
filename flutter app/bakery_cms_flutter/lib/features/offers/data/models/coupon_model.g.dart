// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'coupon_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CouponModel _$CouponModelFromJson(Map<String, dynamic> json) => CouponModel(
  id: JsonReaders.string(json['id']),
  code: JsonReaders.string(json['code']),
  label: JsonReaders.string(json['label']),
  description: JsonReaders.string(json['description']),
  isActive: JsonReaders.boolTrue(json['isActive']),
  categoryIds: JsonReaders.strings(json['categoryIds']),
  minSubtotal: JsonReaders.toDoubleOrNull(json['minSubtotal']),
  percentOff: JsonReaders.toDoubleOrNull(json['percentOff']),
  flatOff: JsonReaders.toDoubleOrNull(json['flatOff']),
  expiresAt: json['expiresAt'] as String?,
);
