import 'package:equatable/equatable.dart';

import 'razorpay_order.dart';

/// Everything the payment sheet shows and prefills.
class PaymentRequest extends Equatable {
  const PaymentRequest({
    required this.order,
    required this.shopName,
    required this.description,
    required this.name,
    required this.email,
    required this.phone,
  });

  final RazorpayOrder order;
  final String shopName;
  final String description;
  final String name;
  final String email;
  final String phone;

  @override
  List<Object?> get props => [order, shopName, description, name, email, phone];
}
