import 'package:equatable/equatable.dart';

/// The first day the shop can deliver, on the shop's own calendar.
class EarliestDelivery extends Equatable {
  const EarliestDelivery({required this.date, required this.daysFromToday});

  /// Midnight of that day, as the shop's wall clock reads it.
  final DateTime date;

  /// 0 for today, 1 for tomorrow, and so on.
  final int daysFromToday;

  bool get isToday => daysFromToday == 0;

  bool get isTomorrow => daysFromToday == 1;

  @override
  List<Object?> get props => [date, daysFromToday];
}
