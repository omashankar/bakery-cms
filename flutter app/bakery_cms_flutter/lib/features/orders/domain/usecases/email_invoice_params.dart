import 'package:equatable/equatable.dart';

class EmailInvoiceParams extends Equatable {
  const EmailInvoiceParams({required this.orderNumber, required this.email});

  final String orderNumber;

  /// The owner's email, the lookup the shop checks ownership with. It is
  /// not where the invoice goes: the shop mails the address on the order.
  final String email;

  @override
  List<Object?> get props => [orderNumber, email];
}
