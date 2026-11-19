import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';

import '../../../../core/utils/view_status.dart';
import '../../../addresses/domain/entities/saved_address.dart';
import '../../../cart/domain/entities/cart_item.dart';
import '../../../offers/domain/entities/offer_cart_line.dart';
import '../../../orders/domain/entities/cancellation_class.dart';
import '../../../store/domain/entities/delivery_tier.dart';
import '../../domain/entities/checkout_address.dart';
import '../../domain/entities/order_confirmation.dart';
import '../../domain/entities/payment_method.dart';
import '../../domain/entities/pin_check_result.dart';
import '../../domain/entities/quote.dart';
import 'coupon_status.dart';

/// Everything on the checkout screen. Immutable; every change is a copyWith.
class CheckoutState extends Equatable {
  const CheckoutState({
    this.setupStatus = ViewStatus.initial,
    this.items = const [],
    this.currency = 'INR',
    this.shopName = '',
    this.zonesRequired = false,
    this.tierRequired = false,
    this.giftWrapAvailable = false,
    this.giftWrapFee = 0,
    this.giftWrapLabel = '',
    this.checkoutTerms = '',
    this.cancellationPolicyText = '',
    this.policyClasses = const [CancellationClass.standard],
    this.minOrderValue = 0,
    this.maintenanceNotice,
    this.occasionOptions = const [],
    this.codBlockedBy = const [],
    this.offerLines,
    this.codOffered = false,
    this.tiers = const [],
    this.fallbackSlots = const [],
    this.dates = const [],
    this.windows = const [],
    this.codAvailable = false,
    this.onlineAvailable = false,
    this.address = const CheckoutAddress(),
    this.savedAddresses = const [],
    this.tierId,
    this.date,
    this.timeSlot,
    this.giftWrap = false,
    this.couponCode,
    this.couponRejected = false,
    this.orderNotes = '',
    this.occasion,
    this.giftMessage = '',
    this.senderName = '',
    this.senderPhone = '',
    this.hideSender = false,
    this.termsAccepted = false,
    this.termsError,
    this.paymentMethod,
    this.pinStatus = ViewStatus.initial,
    this.pinResult,
    this.estimateStatus = ViewStatus.initial,
    this.quote,
    this.estimateError,
    this.placeStatus = ViewStatus.initial,
    this.confirmation,
    this.paidNotice,
    this.errorMessage,
    this.errorField,
    this.errorId = 0,
  });

  // What the shop and the cart allow (set once, on start).
  final ViewStatus setupStatus;
  final List<CartItem> items;
  final String currency;
  final String shopName;

  /// The shop delivers by area, so a map pin is required.
  final bool zonesRequired;

  /// The shop offers delivery speeds, so one must be chosen.
  final bool tierRequired;
  final bool giftWrapAvailable;
  final double giftWrapFee;
  final String giftWrapLabel;
  final String checkoutTerms;

  /// The shop's full cancellation wording, under the cart's rules.
  final String cancellationPolicyText;

  /// Each kind of cancellation rule in this cart, strictest first.
  final List<CancellationClass> policyClasses;

  /// Below this subtotal the shop takes no order (0: no minimum).
  final double minOrderValue;

  /// The shop's maintenance notice while it is closed; null while open.
  final String? maintenanceNotice;

  /// The occasions the shop tagged its products with. Empty: nothing asked.
  final List<String> occasionOptions;

  /// The cart lines that take no cash (the live catalogue's word).
  final List<String> codBlockedBy;

  /// The cart lines as a coupon sees them, each with its product's live
  /// categories, for the offers under the coupon box. Null until the live
  /// catalogue answers (or when it cannot be read): every coupon is then
  /// measured against the subtotal, and a scoped one says "selected items".
  final List<OfferCartLine>? offerLines;

  /// The shop takes cash on delivery at all (before this cart).
  final bool codOffered;
  final List<DeliveryTier> tiers;

  /// The shop's plain slots, used when it offers no speeds.
  final List<String> fallbackSlots;
  final List<DateTime> dates;

  /// The windows bookable for the chosen speed on the chosen date.
  final List<String> windows;
  final bool codAvailable;
  final bool onlineAvailable;

  // What the customer chose.
  final CheckoutAddress address;

  /// The customer's address book, default first; empty when they have none.
  final List<SavedAddress> savedAddresses;
  final String? tierId;
  final DateTime? date;
  final String? timeSlot;
  final bool giftWrap;

  /// The code the customer applied; [couponRejected] when the shop said no.
  final String? couponCode;
  final bool couponRejected;
  final String orderNotes;

  // Personalise this gift.
  final String? occasion;
  final String giftMessage;
  final String senderName;
  final String senderPhone;
  final bool hideSender;

  /// The consent tick. The order refuses to go without it.
  final bool termsAccepted;

  /// Why Place order refused over the tick, shown under the box until ticked.
  final String? termsError;
  final PaymentMethod? paymentMethod;

  // Requests in flight.
  final ViewStatus pinStatus;
  final PinCheckResult? pinResult;
  final ViewStatus estimateStatus;

  /// The latest running total.
  final Quote? quote;
  final String? estimateError;
  final ViewStatus placeStatus;
  final OrderConfirmation? confirmation;

  /// Set once a payment went through but the order was not confirmed.
  /// Checkout is then locked for good: the customer must not pay again.
  final String? paidNotice;

  /// A one-shot message for a snackbar. [errorId] changes with every new one,
  /// so the same refusal twice in a row is still shown twice.
  final String? errorMessage;

  /// The field the shop (or the bloc) blamed, e.g. `location`.
  final String? errorField;
  final int errorId;

  bool get isPlacing => placeStatus.isLoading;

  bool get isLocked => paidNotice != null;

  CouponStatus get couponStatus {
    final code = couponCode;
    if (code == null) return CouponStatus.none;
    if (couponRejected) return CouponStatus.rejected;
    if (estimateStatus.isLoading) return CouponStatus.checking;
    final priced = quote?.coupon?.code;
    final confirmed =
        estimateStatus.isSuccess && priced != null && priced.toUpperCase() == code.toUpperCase();
    return confirmed ? CouponStatus.applied : CouponStatus.unconfirmed;
  }

  DeliveryTier? get selectedTier {
    for (final tier in tiers) {
      if (tier.id == tierId) return tier;
    }
    return null;
  }

  /// Whether a window must be picked: the speed (or shop) offers some.
  /// The subtotal the minimum is checked against: the shop's, once priced.
  double get subtotal =>
      quote?.totals.subtotal ?? items.fold<double>(0, (sum, item) => sum + item.lineTotal);

  /// Below the shop's minimum order value: the website's
  /// `commerce.minOrderValue > 0 && totals.subtotal < commerce.minOrderValue`.
  bool get belowMinimumOrder => minOrderValue > 0 && subtotal < minOrderValue;

  bool get isClosed => maintenanceNotice != null;

  bool get slotRequired => (selectedTier?.windows ?? fallbackSlots).isNotEmpty;

  CheckoutState copyWith({
    ViewStatus? setupStatus,
    List<CartItem>? items,
    String? currency,
    String? shopName,
    bool? zonesRequired,
    bool? tierRequired,
    bool? giftWrapAvailable,
    double? giftWrapFee,
    String? giftWrapLabel,
    String? checkoutTerms,
    String? cancellationPolicyText,
    List<CancellationClass>? policyClasses,
    double? minOrderValue,
    ValueGetter<String?>? maintenanceNotice,
    List<String>? occasionOptions,
    List<String>? codBlockedBy,
    ValueGetter<List<OfferCartLine>?>? offerLines,
    bool? codOffered,
    List<DeliveryTier>? tiers,
    List<String>? fallbackSlots,
    List<DateTime>? dates,
    List<String>? windows,
    bool? codAvailable,
    bool? onlineAvailable,
    CheckoutAddress? address,
    List<SavedAddress>? savedAddresses,
    ValueGetter<String?>? tierId,
    ValueGetter<DateTime?>? date,
    ValueGetter<String?>? timeSlot,
    bool? giftWrap,
    ValueGetter<String?>? couponCode,
    bool? couponRejected,
    String? orderNotes,
    ValueGetter<String?>? occasion,
    String? giftMessage,
    String? senderName,
    String? senderPhone,
    bool? hideSender,
    bool? termsAccepted,
    ValueGetter<String?>? termsError,
    ValueGetter<PaymentMethod?>? paymentMethod,
    ViewStatus? pinStatus,
    ValueGetter<PinCheckResult?>? pinResult,
    ViewStatus? estimateStatus,
    ValueGetter<Quote?>? quote,
    ValueGetter<String?>? estimateError,
    ViewStatus? placeStatus,
    ValueGetter<OrderConfirmation?>? confirmation,
    String? paidNotice,
    String? errorMessage,
    String? errorField,
  }) {
    final raisesError = errorMessage != null;
    return CheckoutState(
      setupStatus: setupStatus ?? this.setupStatus,
      items: items ?? this.items,
      currency: currency ?? this.currency,
      shopName: shopName ?? this.shopName,
      zonesRequired: zonesRequired ?? this.zonesRequired,
      tierRequired: tierRequired ?? this.tierRequired,
      giftWrapAvailable: giftWrapAvailable ?? this.giftWrapAvailable,
      giftWrapFee: giftWrapFee ?? this.giftWrapFee,
      giftWrapLabel: giftWrapLabel ?? this.giftWrapLabel,
      checkoutTerms: checkoutTerms ?? this.checkoutTerms,
      cancellationPolicyText: cancellationPolicyText ?? this.cancellationPolicyText,
      policyClasses: policyClasses ?? this.policyClasses,
      minOrderValue: minOrderValue ?? this.minOrderValue,
      maintenanceNotice: maintenanceNotice != null ? maintenanceNotice() : this.maintenanceNotice,
      occasionOptions: occasionOptions ?? this.occasionOptions,
      codBlockedBy: codBlockedBy ?? this.codBlockedBy,
      offerLines: offerLines != null ? offerLines() : this.offerLines,
      codOffered: codOffered ?? this.codOffered,
      tiers: tiers ?? this.tiers,
      fallbackSlots: fallbackSlots ?? this.fallbackSlots,
      dates: dates ?? this.dates,
      windows: windows ?? this.windows,
      codAvailable: codAvailable ?? this.codAvailable,
      onlineAvailable: onlineAvailable ?? this.onlineAvailable,
      address: address ?? this.address,
      savedAddresses: savedAddresses ?? this.savedAddresses,
      tierId: tierId != null ? tierId() : this.tierId,
      date: date != null ? date() : this.date,
      timeSlot: timeSlot != null ? timeSlot() : this.timeSlot,
      giftWrap: giftWrap ?? this.giftWrap,
      couponCode: couponCode != null ? couponCode() : this.couponCode,
      couponRejected: couponRejected ?? this.couponRejected,
      orderNotes: orderNotes ?? this.orderNotes,
      occasion: occasion != null ? occasion() : this.occasion,
      giftMessage: giftMessage ?? this.giftMessage,
      senderName: senderName ?? this.senderName,
      senderPhone: senderPhone ?? this.senderPhone,
      hideSender: hideSender ?? this.hideSender,
      termsAccepted: termsAccepted ?? this.termsAccepted,
      termsError: termsError != null ? termsError() : this.termsError,
      paymentMethod: paymentMethod != null ? paymentMethod() : this.paymentMethod,
      pinStatus: pinStatus ?? this.pinStatus,
      pinResult: pinResult != null ? pinResult() : this.pinResult,
      estimateStatus: estimateStatus ?? this.estimateStatus,
      quote: quote != null ? quote() : this.quote,
      estimateError: estimateError != null ? estimateError() : this.estimateError,
      placeStatus: placeStatus ?? this.placeStatus,
      confirmation: confirmation != null ? confirmation() : this.confirmation,
      paidNotice: paidNotice ?? this.paidNotice,
      // One-shot: carried only by the emit that raises it.
      errorMessage: errorMessage,
      errorField: raisesError ? errorField : null,
      errorId: raisesError ? errorId + 1 : errorId,
    );
  }

  @override
  List<Object?> get props => [
    setupStatus,
    items,
    currency,
    shopName,
    zonesRequired,
    tierRequired,
    giftWrapAvailable,
    giftWrapFee,
    giftWrapLabel,
    checkoutTerms,
    cancellationPolicyText,
    policyClasses,
    minOrderValue,
    maintenanceNotice,
    occasionOptions,
    codBlockedBy,
    offerLines,
    codOffered,
    tiers,
    fallbackSlots,
    dates,
    windows,
    codAvailable,
    onlineAvailable,
    address,
    savedAddresses,
    tierId,
    date,
    timeSlot,
    giftWrap,
    couponCode,
    couponRejected,
    orderNotes,
    occasion,
    giftMessage,
    senderName,
    senderPhone,
    hideSender,
    termsAccepted,
    termsError,
    paymentMethod,
    pinStatus,
    pinResult,
    estimateStatus,
    quote,
    estimateError,
    placeStatus,
    confirmation,
    paidNotice,
    errorMessage,
    errorField,
    errorId,
  ];
}
