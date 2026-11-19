import 'package:equatable/equatable.dart';

import '../../../cart/domain/entities/cart_item.dart';
import 'checkout_address.dart';
import 'delivery_slot.dart';
import 'order_personalisation.dart';

/// What the customer chose. Never a price: the shop prices it.
///
/// With only [pincode]/[city]/[state] this is a running estimate. With an
/// [address] it is the final quote, and the shop then requires its map pin.
class QuoteRequest extends Equatable {
  const QuoteRequest({
    required this.items,
    this.couponCode,
    this.giftWrap = false,
    this.deliveryTierId,
    this.pincode,
    this.city,
    this.state,
    this.address,
    this.slot,
    this.orderNotes,
    this.personalisation,
  });

  final List<CartItem> items;
  final String? couponCode;
  final bool giftWrap;
  final String? deliveryTierId;
  final String? pincode;
  final String? city;
  final String? state;
  final CheckoutAddress? address;
  final DeliverySlot? slot;
  final String? orderNotes;

  /// Sent on the final quote, so the draft holds it (see [OrderPersonalisation]).
  final OrderPersonalisation? personalisation;

  @override
  List<Object?> get props => [
    items,
    couponCode,
    giftWrap,
    deliveryTierId,
    pincode,
    city,
    state,
    address,
    slot,
    orderNotes,
    personalisation,
  ];
}
