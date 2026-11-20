import 'package:equatable/equatable.dart';

/// One of the shop's coupons, as `GET /api/coupons` lists it for a visitor:
/// only live ones (switched on, not expired) are sent, and checkout re-checks
/// every rule on the server.
class Coupon extends Equatable {
  const Coupon({
    required this.id,
    required this.code,
    required this.label,
    this.description = '',
    this.minSubtotal,
    this.percentOff,
    this.flatOff,
    this.isActive = true,
    this.expiresAt,
    this.expiryUnreadable = false,
    this.categoryIds = const [],
  });

  final String id;
  final String code;

  /// The shop's own headline for it.
  final String label;
  final String description;

  /// The basket it needs, before the discount. Null or 0: none.
  final double? minSubtotal;
  final double? percentOff;
  final double? flatOff;
  final bool isActive;
  final DateTime? expiresAt;

  /// The stored expiry could not be read as a date: the website treats that
  /// as expired (`hasExpired` fails closed).
  final bool expiryUnreadable;

  /// The categories it applies to; empty means the whole shop.
  final List<String> categoryIds;

  bool get isScoped => categoryIds.isNotEmpty;

  @override
  List<Object?> get props => [
    id,
    code,
    label,
    description,
    minSubtotal,
    percentOff,
    flatOff,
    isActive,
    expiresAt,
    expiryUnreadable,
    categoryIds,
  ];
}
