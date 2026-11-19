import 'package:equatable/equatable.dart';

import 'delivery_tier.dart';
import 'payment_methods.dart';

/// The shop's public settings (`GET /api/settings/public`): its name, and the
/// commerce rules checkout follows. Display only. The server re-applies every
/// rule when it prices the cart.
class StoreConfig extends Equatable {
  const StoreConfig({
    required this.siteName,
    required this.tagline,
    required this.logoUrl,
    this.faviconUrl = '',
    required this.currency,
    this.timezone = defaultTimezone,
    required this.deliveryFee,
    required this.freeDeliveryThreshold,
    required this.minOrderValue,
    required this.useZoneBasedDelivery,
    required this.deliveryLeadDays,
    required this.sameDayCutoff,
    required this.deliveryTimeSlots,
    required this.deliveryTiers,
    required this.giftWrapEnabled,
    required this.giftWrapFee,
    required this.giftWrapLabel,
    required this.checkoutTerms,
    required this.paymentMethods,
    required this.maintenanceEnabled,
    required this.maintenanceMessage,
    this.cancellationPolicyText = '',
    this.modules = const {},
  });

  final String siteName;
  final String tagline;
  final String logoUrl;

  /// A small square mark (the website's favicon).
  final String faviconUrl;
  final String currency;

  /// The shop's clock (General → Timezone). Delivery dates, the same-day
  /// cutoff and today's windows are decided on it, as the server decides them.
  final String timezone;

  static const String defaultTimezone = 'Asia/Kolkata';
  final double deliveryFee;
  final double freeDeliveryThreshold;
  final double minOrderValue;

  /// When true, a full delivery address must carry a map pin inside one of
  /// the shop's delivery areas, or the quote is refused.
  final bool useZoneBasedDelivery;
  final int deliveryLeadDays;

  /// "14:00": after this, today can no longer be chosen. Empty = no cutoff.
  final String sameDayCutoff;
  final List<String> deliveryTimeSlots;
  final List<DeliveryTier> deliveryTiers;
  final bool giftWrapEnabled;
  final double giftWrapFee;
  final String giftWrapLabel;
  final String checkoutTerms;
  final PaymentMethods paymentMethods;
  final bool maintenanceEnabled;
  final String maintenanceMessage;

  /// The shop's own cancellation wording (Commerce settings), shown under the
  /// cart's cancellation rules above the consent tick. Empty when it has none.
  final String cancellationPolicyText;

  /// The shop's module switches (`modules` in the public settings), as sent.
  /// Read them through [isModuleOn]: a module the shop never set is on.
  final Map<String, bool> modules;

  /// The website's notice for a shop that switched maintenance on without
  /// writing one (`defaultMaintenanceSettings.message`).
  static const String defaultMaintenanceNotice =
      'We are currently performing scheduled maintenance. Please check back shortly.';

  /// Whether the module [key] (one of `StoreModules`) is switched on.
  ///
  /// Fails open, like the website (`{ ...defaultModuleSettings, ...modules }`):
  /// a module missing from the answer is on. A module that is off hides its
  /// options AND drops their surcharge from the price (the shape module's
  /// variant groups, for one), exactly as the website prices it.
  bool isModuleOn(String key) => modules[key] ?? true;

  /// What the closed shop says: its own words, or the website's default.
  String get maintenanceNotice {
    final own = maintenanceMessage.trim();
    return own.isEmpty ? defaultMaintenanceNotice : own;
  }

  @override
  List<Object?> get props => [
    siteName,
    tagline,
    logoUrl,
    faviconUrl,
    currency,
    timezone,
    deliveryFee,
    freeDeliveryThreshold,
    minOrderValue,
    useZoneBasedDelivery,
    deliveryLeadDays,
    sameDayCutoff,
    deliveryTimeSlots,
    deliveryTiers,
    giftWrapEnabled,
    giftWrapFee,
    giftWrapLabel,
    checkoutTerms,
    paymentMethods,
    maintenanceEnabled,
    maintenanceMessage,
    cancellationPolicyText,
    modules,
  ];
}
