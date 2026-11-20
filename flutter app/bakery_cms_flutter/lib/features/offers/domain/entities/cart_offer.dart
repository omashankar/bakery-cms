import 'package:equatable/equatable.dart';

import 'coupon_check.dart';

/// A live offer this basket has not taken yet, and what it needs: the
/// website's `CartOffer` plus what applying it would save now.
class CartOffer extends Equatable {
  const CartOffer({
    required this.code,
    required this.label,
    required this.shortfall,
    required this.check,
  });

  final String code;

  /// The discount as the customer reads it ("20% OFF").
  final String label;

  /// What the basket is still short of, or 0 when the code already applies.
  final double shortfall;

  /// The code tried against the basket, only when nothing is short (the
  /// cart panel prices it then, by the rule checkout runs).
  final CouponCheck? check;

  @override
  List<Object?> get props => [code, label, shortfall, check];
}
