// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_settings_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommerceSettingsModel _$CommerceSettingsModelFromJson(Map<String, dynamic> json) =>
    CommerceSettingsModel(
      deliveryFee: JsonReaders.toDouble(json['deliveryFee']),
      freeDeliveryThreshold: JsonReaders.toDouble(json['freeDeliveryThreshold']),
      minOrderValue: JsonReaders.toDouble(json['minOrderValue']),
      useZoneBasedDelivery: JsonReaders.boolOr(json['useZoneBasedDelivery']),
      deliveryLeadDays: JsonReaders.toInt(json['deliveryLeadDays']),
      sameDayCutoff: JsonReaders.string(json['sameDayCutoff']),
      deliveryTimeSlots: JsonReaders.strings(json['deliveryTimeSlots']),
      deliveryTiers:
          (json['deliveryTiers'] as List<dynamic>?)
              ?.map((e) => DeliveryTierModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      giftWrapEnabled: JsonReaders.boolTrue(json['giftWrapEnabled']),
      giftWrapFee: JsonReaders.toDouble(json['giftWrapFee']),
      giftWrapLabel: JsonReaders.string(json['giftWrapLabel']),
      checkoutTerms: JsonReaders.string(json['checkoutTerms']),
      cancellationPolicyText: json['cancellationPolicyText'] == null
          ? ''
          : JsonReaders.string(json['cancellationPolicyText']),
      paymentMethods: json['paymentMethods'] == null
          ? null
          : PaymentMethodsModel.fromJson(json['paymentMethods'] as Map<String, dynamic>),
    );
