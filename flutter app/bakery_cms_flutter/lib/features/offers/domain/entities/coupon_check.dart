import 'package:equatable/equatable.dart';

/// A coupon tried against a basket: what it would take off ([saving], when
/// it applies) or why it does not ([message]). The website's `evaluateCoupon`
/// answer. Display only: the server decides at checkout.
class CouponCheck extends Equatable {
  const CouponCheck.applies(double this.saving) : message = null;

  const CouponCheck.refused(String this.message) : saving = null;

  final double? saving;
  final String? message;

  bool get applies => saving != null;

  @override
  List<Object?> get props => [saving, message];
}
