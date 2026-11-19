import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/applied_coupon.dart';

part 'applied_coupon_model.g.dart';

@JsonSerializable(createToJson: false)
class AppliedCouponModel {
  const AppliedCouponModel({required this.code, required this.label, required this.discountAmount});

  factory AppliedCouponModel.fromJson(Map<String, dynamic> json) =>
      _$AppliedCouponModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String code;
  @JsonKey(fromJson: JsonReaders.string)
  final String label;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double discountAmount;

  AppliedCoupon toEntity() =>
      AppliedCoupon(code: code, label: label, discountAmount: discountAmount);
}
