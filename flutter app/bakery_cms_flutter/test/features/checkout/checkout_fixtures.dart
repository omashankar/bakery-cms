import 'package:bakery_cms_flutter/features/cart/domain/entities/cart.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/delivery_slot.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/geo_point.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/order_confirmation.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/payment_method.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_check_result.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/pin_status.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/quote.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/razorpay_order.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/usecases/place_order_params.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/order_totals.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/delivery_tier.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/payment_methods.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';

/// Monday 16 Nov 2026, 09:00: before the 14:00 cutoff.
final DateTime morning = DateTime(2026, 11, 16, 9);

const CartItem cake = CartItem(
  id: 'truffle|1.5 Kg||||',
  productSlug: 'truffle-cake',
  name: 'Truffle Cake',
  image: '',
  unitPrice: 999,
  quantity: 1,
  weight: '1.5 Kg',
);

const Cart cart = Cart([cake]);

const DeliveryTier standard = DeliveryTier(
  id: 'standard',
  label: 'Standard Delivery',
  description: 'Any time in the window you pick',
  fee: 0,
  windows: ['10:00 AM – 12:00 PM', '12:00 PM – 2:00 PM', '6:00 PM – 8:00 PM'],
);

const DeliveryTier midnight = DeliveryTier(
  id: 'midnight',
  label: 'Midnight Delivery',
  description: 'Between 11 PM and midnight',
  fee: 250,
  windows: ['11:00 PM – 12:00 AM'],
);

const StoreConfig config = StoreConfig(
  siteName: 'Sweet Crumbs Bakery',
  tagline: '',
  logoUrl: '',
  currency: 'INR',
  deliveryFee: 99,
  freeDeliveryThreshold: 999,
  minOrderValue: 0,
  useZoneBasedDelivery: true,
  deliveryLeadDays: 0,
  sameDayCutoff: '14:00',
  deliveryTimeSlots: ['10:00 AM – 12:00 PM'],
  deliveryTiers: [standard, midnight],
  giftWrapEnabled: true,
  giftWrapFee: 49,
  giftWrapLabel: 'Gift wrap',
  checkoutTerms: 'Terms',
  paymentMethods: PaymentMethods(cod: true, upi: true, card: true, razorpay: true),
  maintenanceEnabled: false,
  maintenanceMessage: '',
);

const GeoPoint door = GeoPoint(lat: 25.18, lng: 75.83);

const CheckoutAddress address = CheckoutAddress(
  fullName: 'Asha Verma',
  email: 'asha@example.com',
  phone: '9876543210',
  addressLine1: '12 Park Road',
  city: 'Kota',
  state: 'Rajasthan',
  pincode: '324001',
  location: door,
);

const PinCheckResult eligiblePin = PinCheckResult(
  status: PinStatus.eligible,
  charge: 99,
  city: 'Kota',
  state: 'Rajasthan',
  postalCode: '324001',
);

const OrderTotals totals = OrderTotals(
  subtotal: 999,
  delivery: 0,
  tax: 49.95,
  discount: 0,
  platformCharge: 0,
  giftWrapFee: 0,
  deliveryTierFee: 0,
  total: 1048.95,
  itemCount: 1,
);

const Quote quote = Quote(draftId: 'draft-1', totals: totals);

const RazorpayOrder razorpayOrder = RazorpayOrder(
  orderId: 'order_rzp_1',
  amount: 104895,
  currency: 'INR',
  keyId: 'rzp_test_key',
);

const OrderConfirmation confirmation = OrderConfirmation(
  id: 'order-id-1',
  orderNumber: 'BK-20261116-4821',
  total: 1048.95,
  paymentMethod: 'cod',
);

final DeliverySlot slot = DeliverySlot(
  date: DateTime(2026, 11, 16),
  timeSlot: '12:00 PM – 2:00 PM',
  tierId: 'standard',
  tierLabel: 'Standard Delivery',
);

PlaceOrderParams paramsFor(PaymentMethod method) => PlaceOrderParams(
      orderId: 'uuid-1',
      expectedTotal: totals.total,
      items: cart.items,
      address: address,
      slot: slot,
      paymentMethod: method,
      shopName: config.siteName,
    );
