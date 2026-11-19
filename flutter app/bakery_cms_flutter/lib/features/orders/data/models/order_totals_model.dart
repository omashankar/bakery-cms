import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/order_totals.dart';

part 'order_totals_model.g.dart';

/// `CartTotals` from the shop's API: shared by a checkout quote and a placed
/// order.
@JsonSerializable(createToJson: false)
class OrderTotalsModel {
  const OrderTotalsModel({
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

  factory OrderTotalsModel.fromJson(Map<String, dynamic> json) => _$OrderTotalsModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.toDouble)
  final double subtotal;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double delivery;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double tax;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double discount;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double platformCharge;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double giftWrapFee;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double deliveryTierFee;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double total;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int itemCount;
  final String? deliveryTierLabel;
  final String? taxLabel;

  OrderTotals toEntity() => OrderTotals(
    subtotal: subtotal,
    delivery: delivery,
    tax: tax,
    discount: discount,
    platformCharge: platformCharge,
    giftWrapFee: giftWrapFee,
    deliveryTierFee: deliveryTierFee,
    total: total,
    itemCount: itemCount,
    deliveryTierLabel: deliveryTierLabel,
    taxLabel: taxLabel,
  );
}
