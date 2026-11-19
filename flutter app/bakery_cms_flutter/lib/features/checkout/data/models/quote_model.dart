import 'package:json_annotation/json_annotation.dart';

import '../../../orders/data/models/order_totals_model.dart';
import '../../domain/entities/quote.dart';
import 'applied_coupon_model.dart';

part 'quote_model.g.dart';

@JsonSerializable(createToJson: false)
class QuoteModel {
  const QuoteModel({required this.draftId, required this.totals, this.coupon, this.rejectedCoupon});

  factory QuoteModel.fromJson(Map<String, dynamic> json) => _$QuoteModelFromJson(json);

  final String draftId;
  final OrderTotalsModel totals;
  final AppliedCouponModel? coupon;
  final String? rejectedCoupon;

  Quote toEntity() => Quote(
    draftId: draftId,
    totals: totals.toEntity(),
    coupon: coupon?.toEntity(),
    rejectedCoupon: rejectedCoupon,
  );
}
