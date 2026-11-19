import 'package:equatable/equatable.dart';

import '../../../../core/utils/view_status.dart';
import '../../domain/entities/coupon.dart';

/// The shop's live coupons: initial → loading → success | failure. Every
/// surface draws nothing until there is something true to say, so the
/// failure state is silent too (the website's offers row renders nothing
/// without live coupons).
class OffersState extends Equatable {
  const OffersState({this.status = ViewStatus.initial, this.coupons = const []});

  final ViewStatus status;
  final List<Coupon> coupons;

  @override
  List<Object?> get props => [status, coupons];
}
