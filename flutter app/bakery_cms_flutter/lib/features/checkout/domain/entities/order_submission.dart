import 'package:equatable/equatable.dart';

import '../../../cart/domain/entities/cart_item.dart';
import '../../../orders/domain/entities/order_totals.dart';
import 'checkout_address.dart';
import 'delivery_slot.dart';
import 'order_personalisation.dart';
import 'payment_method.dart';

/// The `POST /api/orders` body. With a [draftId] the shop uses its own
/// prices and totals; [items] and [totals] are only there because the
/// schema still requires them.
class OrderSubmission extends Equatable {
  const OrderSubmission({
    required this.id,
    required this.draftId,
    required this.items,
    required this.totals,
    required this.address,
    required this.slot,
    required this.paymentMethod,
    this.paymentReference,
    this.orderNotes,
    this.personalisation,
  });

  /// The idempotency key: a retry re-sends the same id, so a dropped answer
  /// can never place the order twice.
  final String id;
  final String draftId;
  final List<CartItem> items;
  final OrderTotals totals;
  final CheckoutAddress address;
  final DeliverySlot slot;
  final PaymentMethod paymentMethod;

  /// The gateway's payment id, for an online payment.
  final String? paymentReference;
  final String? orderNotes;
  final OrderPersonalisation? personalisation;

  @override
  List<Object?> get props => [
    id,
    draftId,
    items,
    totals,
    address,
    slot,
    paymentMethod,
    paymentReference,
    orderNotes,
    personalisation,
  ];
}
