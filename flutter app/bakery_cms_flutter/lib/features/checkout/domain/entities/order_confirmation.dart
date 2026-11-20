import 'package:equatable/equatable.dart';

/// What checkout needs back from a placed order.
class OrderConfirmation extends Equatable {
  const OrderConfirmation({
    required this.id,
    required this.orderNumber,
    required this.total,
    required this.paymentMethod,
  });

  final String id;
  final String orderNumber;
  final double total;
  final String paymentMethod;

  @override
  List<Object?> get props => [id, orderNumber, total, paymentMethod];
}
