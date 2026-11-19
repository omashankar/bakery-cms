import 'package:equatable/equatable.dart';

/// The shop's price breakdown (`CartTotals` on the server). Used both for a
/// checkout quote and for a placed order. Every number here was computed by
/// the server.
class OrderTotals extends Equatable {
  const OrderTotals({
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

  static const OrderTotals zero = OrderTotals(
    subtotal: 0,
    delivery: 0,
    tax: 0,
    discount: 0,
    platformCharge: 0,
    giftWrapFee: 0,
    deliveryTierFee: 0,
    total: 0,
    itemCount: 0,
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

  @override
  List<Object?> get props => [
    subtotal,
    delivery,
    tax,
    discount,
    platformCharge,
    giftWrapFee,
    deliveryTierFee,
    total,
    itemCount,
    deliveryTierLabel,
    taxLabel,
  ];
}
