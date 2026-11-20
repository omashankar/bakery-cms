import 'package:equatable/equatable.dart';

/// The day, window and speed the customer booked.
class DeliverySlot extends Equatable {
  const DeliverySlot({required this.date, required this.timeSlot, this.tierId, this.tierLabel});

  /// A calendar day; the time part is ignored.
  final DateTime date;
  final String timeSlot;
  final String? tierId;
  final String? tierLabel;

  @override
  List<Object?> get props => [date, timeSlot, tierId, tierLabel];
}
