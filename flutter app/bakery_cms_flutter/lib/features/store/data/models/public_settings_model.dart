import 'package:json_annotation/json_annotation.dart';

import '../../../../core/constants/app_strings.dart';
import '../../domain/entities/payment_methods.dart';
import '../../domain/entities/store_config.dart';
import 'commerce_settings_model.dart';
import 'general_settings_model.dart';
import 'maintenance_model.dart';

part 'public_settings_model.g.dart';

/// `GET /api/settings/public` → `data`.
@JsonSerializable(createToJson: false)
class PublicSettingsModel {
  const PublicSettingsModel({
    required this.general,
    required this.commerce,
    this.maintenance,
    this.modules = const {},
  });

  factory PublicSettingsModel.fromJson(Map<String, dynamic> json) =>
      _$PublicSettingsModelFromJson(json);

  final GeneralSettingsModel general;
  final CommerceSettingsModel commerce;
  final MaintenanceModel? maintenance;

  /// `modules`: only the switches that are real booleans. Anything else is
  /// left out, so it reads as on (see `StoreConfig.isModuleOn`).
  @JsonKey(fromJson: _modules)
  final Map<String, bool> modules;

  static const String _defaultCurrency = 'INR';
  static const PaymentMethods _codOnly = PaymentMethods(
    cod: true,
    upi: false,
    card: false,
    razorpay: false,
  );

  static Map<String, bool> _modules(Object? value) => value is Map
      ? {
          for (final entry in value.entries)
            if (entry.key is String && entry.value is bool)
              entry.key as String: entry.value as bool,
        }
      : const {};

  StoreConfig toEntity() => StoreConfig(
    siteName: general.siteName.isEmpty ? AppStrings.appName : general.siteName,
    tagline: general.siteTagline,
    logoUrl: general.logo,
    faviconUrl: general.favicon,
    currency: general.currency.isEmpty ? _defaultCurrency : general.currency,
    timezone: general.timezone.isEmpty ? StoreConfig.defaultTimezone : general.timezone,
    deliveryFee: commerce.deliveryFee,
    freeDeliveryThreshold: commerce.freeDeliveryThreshold,
    minOrderValue: commerce.minOrderValue,
    useZoneBasedDelivery: commerce.useZoneBasedDelivery,
    deliveryLeadDays: commerce.deliveryLeadDays,
    sameDayCutoff: commerce.sameDayCutoff,
    deliveryTimeSlots: commerce.deliveryTimeSlots,
    deliveryTiers: commerce.deliveryTiers.map((tier) => tier.toEntity()).toList(),
    giftWrapEnabled: commerce.giftWrapEnabled,
    giftWrapFee: commerce.giftWrapFee,
    giftWrapLabel: commerce.giftWrapLabel,
    checkoutTerms: commerce.checkoutTerms,
    cancellationPolicyText: commerce.cancellationPolicyText,
    paymentMethods: commerce.paymentMethods?.toEntity() ?? _codOnly,
    maintenanceEnabled: maintenance?.isEnabled ?? false,
    maintenanceMessage: maintenance?.message ?? '',
    modules: modules,
  );
}
