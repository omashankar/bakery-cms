import 'package:equatable/equatable.dart';

/// Whoever is sending the order, when that is not whoever receives it: the
/// website's `OrderSender` (`features/orders/lib/checkout-draft.ts`).
class OrderSender extends Equatable {
  const OrderSender({required this.name, required this.phone, this.hideFromRecipient = false});

  final String name;
  final String phone;

  /// Keep the sender's name and number off what the recipient is shown. The
  /// shop still has both: it has to be able to reach the person who paid.
  final bool hideFromRecipient;

  @override
  List<Object?> get props => [name, phone, hideFromRecipient];
}
