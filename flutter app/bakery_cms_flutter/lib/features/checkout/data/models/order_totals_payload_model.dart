import 'package:json_annotation/json_annotation.dart';

import '../../../orders/domain/entities/order_totals.dart';

part 'order_totals_payload_model.g.dart';

/// The quote's totals echoed into the order body (ignored with a draft).
@JsonSerializable(createFactory: false, includeIfNull: false)
class OrderTotalsPayloadModel {
  const OrderTotalsPayloadModel({
    required this.subtotal,
    required this.delivery,
    required this.tax,
    required this.discount,
    required this.platformCharge,
    required this.giftWrapFee,
    required this.deliveryTierFee,
    required this.total,
    required this.itemCount,
    this.deliveryTierLabel,
    this.taxLabel,
  });

  factory OrderTotalsPayloadModel.fromEntity(OrderTotals totals) => OrderTotalsPayloadModel(
    subtotal: totals.subtotal,
    delivery: totals.delivery,
    tax: totals.tax,
    discount: totals.discount,
    platformCharge: totals.platformCharge,
    giftWrapFee: totals.giftWrapFee,
    deliveryTierFee: totals.deliveryTierFee,
    total: totals.total,
    itemCount: totals.itemCount,
    deliveryTierLabel: totals.deliveryTierLabel,
    taxLabel: totals.taxLabel,
  );

  final double subtotal;
  final double delivery;
  final double tax;
  final double discount;
  final double platformCharge;
  final double giftWrapFee;
  final double deliveryTierFee;
  final double total;
  final int itemCount;
  final String? deliveryTierLabel;
  final String? taxLabel;

  Map<String, dynamic> toJson() => _$OrderTotalsPayloadModelToJson(this);
}
