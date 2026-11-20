import 'package:equatable/equatable.dart';

/// A delivery speed the shop offers (Standard, Fixed time, Midnight), with
/// its surcharge and the time windows it can be booked in.
class DeliveryTier extends Equatable {
  const DeliveryTier({
    required this.id,
    required this.label,
    required this.description,
    required this.fee,
    required this.windows,
  });

  final String id;
  final String label;
  final String description;
  final double fee;
  final List<String> windows;

  @override
  List<Object?> get props => [id, label, description, fee, windows];
}
