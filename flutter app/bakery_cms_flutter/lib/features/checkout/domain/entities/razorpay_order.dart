import 'package:equatable/equatable.dart';

/// A Razorpay order the shop opened against a priced draft.
class RazorpayOrder extends Equatable {
  const RazorpayOrder({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.keyId,
  });

  final String orderId;

  /// In the minor unit (paise), as Razorpay takes it.
  final int amount;
  final String currency;

  /// The shop's public key id.
  final String keyId;

  @override
  List<Object?> get props => [orderId, amount, currency, keyId];
}
