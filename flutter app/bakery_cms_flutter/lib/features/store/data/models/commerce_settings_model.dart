import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import 'delivery_tier_model.dart';
import 'payment_methods_model.dart';

part 'commerce_settings_model.g.dart';

/// `commerce` in the public settings: only the fields the app uses.
@JsonSerializable(createToJson: false)
class CommerceSettingsModel {
  const CommerceSettingsModel({
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
    this.cancellationPolicyText = '',
    this.paymentMethods,
  });

  factory CommerceSettingsModel.fromJson(Map<String, dynamic> json) =>
      _$CommerceSettingsModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.toDouble)
  final double deliveryFee;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double freeDeliveryThreshold;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double minOrderValue;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool useZoneBasedDelivery;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int deliveryLeadDays;
  @JsonKey(fromJson: JsonReaders.string)
  final String sameDayCutoff;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> deliveryTimeSlots;
  @JsonKey(defaultValue: <DeliveryTierModel>[])
  final List<DeliveryTierModel> deliveryTiers;

  /// On unless the shop turned it off: the server's own default.
  @JsonKey(fromJson: JsonReaders.boolTrue)
  final bool giftWrapEnabled;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double giftWrapFee;
  @JsonKey(fromJson: JsonReaders.string)
  final String giftWrapLabel;
  @JsonKey(fromJson: JsonReaders.string)
  final String checkoutTerms;

  /// The shop's full cancellation wording, under "Read the full policy".
  @JsonKey(fromJson: JsonReaders.string)
  final String cancellationPolicyText;
  final PaymentMethodsModel? paymentMethods;
}
