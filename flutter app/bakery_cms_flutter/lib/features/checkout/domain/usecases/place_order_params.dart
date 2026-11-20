import 'package:equatable/equatable.dart';

import '../../../cart/domain/entities/cart_item.dart';
import '../entities/checkout_address.dart';
import '../entities/delivery_slot.dart';
import '../entities/order_personalisation.dart';
import '../entities/payment_method.dart';

class PlaceOrderParams extends Equatable {
  const PlaceOrderParams({
    required this.orderId,
    required this.items,
    required this.address,
    required this.slot,
    required this.paymentMethod,
    required this.shopName,
    this.expectedTotal,
    this.giftWrap = false,
    this.couponCode,
    this.orderNotes,
    this.personalisation,
  });

  /// The idempotency key, the SAME for every press during one checkout. The
  /// shop answers a repeat with the order it already placed (`already-placed`
  /// in `order.service.ts`), so pressing again after a lost answer can never
  /// create a second order.
  final String orderId;
  final List<CartItem> items;
  final CheckoutAddress address;
  final DeliverySlot slot;
  final PaymentMethod paymentMethod;

  /// Shown on the payment sheet.
  final String shopName;

  /// The total the customer was shown; null when none was. A final price
  /// that differs stops the order before any payment.
  final double? expectedTotal;
  final bool giftWrap;
  final String? couponCode;
  final String? orderNotes;

  /// Sent on the final quote AND the order, as the website sends it on both.
  final OrderPersonalisation? personalisation;

  @override
  List<Object?> get props => [
    orderId,
    items,
    address,
    slot,
    paymentMethod,
    shopName,
    expectedTotal,
    giftWrap,
    couponCode,
    orderNotes,
    personalisation,
  ];
}
