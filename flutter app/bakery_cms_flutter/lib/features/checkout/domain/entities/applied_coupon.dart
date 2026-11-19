import 'package:equatable/equatable.dart';

/// A coupon the shop accepted, and what it took off.
class AppliedCoupon extends Equatable {
  const AppliedCoupon({required this.code, required this.label, required this.discountAmount});

  final String code;
  final String label;
  final double discountAmount;

  @override
  List<Object?> get props => [code, label, discountAmount];
}
