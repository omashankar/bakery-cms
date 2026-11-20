import 'package:equatable/equatable.dart';

/// A captured payment. The shop verifies [paymentId] with Razorpay itself
/// when the order is placed; this is not taken on trust.
class PaymentResult extends Equatable {
  const PaymentResult({required this.paymentId, this.orderId, this.signature});

  final String paymentId;
  final String? orderId;
  final String? signature;

  @override
  List<Object?> get props => [paymentId, orderId, signature];
}
