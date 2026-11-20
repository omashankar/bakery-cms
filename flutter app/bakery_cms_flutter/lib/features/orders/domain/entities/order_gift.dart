import 'package:equatable/equatable.dart';

/// What the customer asked for at "Personalise this gift", as the order
/// keeps it (`personalisation` on the order).
class OrderGift extends Equatable {
  const OrderGift({this.occasion, this.message, this.senderName, this.senderPhone});

  final String? occasion;

  /// For whoever opens the parcel.
  final String? message;
  final String? senderName;
  final String? senderPhone;

  /// The website's order page shows these two and not the sender: the person
  /// reading it is the one who sent it.
  bool get hasNote => occasion != null || message != null;

  @override
  List<Object?> get props => [occasion, message, senderName, senderPhone];
}
