import 'package:equatable/equatable.dart';

/// Which ways to pay the shop has switched on (Settings → Commerce).
/// UPI, card and Razorpay all go through the Razorpay checkout.
class PaymentMethods extends Equatable {
  const PaymentMethods({
    required this.cod,
    required this.upi,
    required this.card,
    required this.razorpay,
  });

  final bool cod;
  final bool upi;
  final bool card;
  final bool razorpay;

  bool get online => upi || card || razorpay;

  @override
  List<Object?> get props => [cod, upi, card, razorpay];
}
