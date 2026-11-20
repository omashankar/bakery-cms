// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'quote_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

QuoteModel _$QuoteModelFromJson(Map<String, dynamic> json) => QuoteModel(
  draftId: json['draftId'] as String,
  totals: OrderTotalsModel.fromJson(json['totals'] as Map<String, dynamic>),
  coupon: json['coupon'] == null
      ? null
      : AppliedCouponModel.fromJson(json['coupon'] as Map<String, dynamic>),
  rejectedCoupon: json['rejectedCoupon'] as String?,
);
