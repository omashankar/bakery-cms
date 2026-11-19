import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/delivery_area.dart';
import '../../domain/entities/delivery_verdict.dart';

part 'delivery_area_model.g.dart';

/// The pincode answer of `POST /api/checkout/delivery-pin`, and the same
/// shape as it is kept on the device (with the [pincode] it was asked for).
///
/// The server sends `{required, status, city, state, charge, minDeliveryDays,
/// freeDeliveryThreshold, priceMayVary, at}`; a shop without delivery areas
/// sends only `{required: false, status: "eligible", charge}`.
@JsonSerializable(includeIfNull: false)
class DeliveryAreaModel {
  const DeliveryAreaModel({
    required this.pincode,
    required this.status,
    this.city = '',
    this.state = '',
    this.charge,
    this.minDeliveryDays,
    this.freeDeliveryThreshold,
    this.priceMayVary = false,
    this.required = true,
  });

  factory DeliveryAreaModel.fromJson(Map<String, dynamic> json) =>
      _$DeliveryAreaModelFromJson(json);

  factory DeliveryAreaModel.fromEntity(DeliveryArea area) => DeliveryAreaModel(
    pincode: area.pincode,
    status: area.verdict.apiName,
    city: area.city,
    state: area.state,
    charge: area.charge,
    minDeliveryDays: area.minDeliveryDays,
    freeDeliveryThreshold: area.freeDeliveryThreshold,
    priceMayVary: area.priceMayVary,
    required: area.zonesRequired,
  );

  /// Not in the server's answer: the caller adds the PIN it asked about.
  @JsonKey(fromJson: JsonReaders.string)
  final String pincode;
  @JsonKey(fromJson: JsonReaders.string)
  final String status;
  @JsonKey(fromJson: JsonReaders.string)
  final String city;
  @JsonKey(fromJson: JsonReaders.string)
  final String state;
  @JsonKey(fromJson: JsonReaders.toDoubleOrNull)
  final double? charge;
  @JsonKey(fromJson: _days)
  final int? minDeliveryDays;
  @JsonKey(fromJson: JsonReaders.toDoubleOrNull)
  final double? freeDeliveryThreshold;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool priceMayVary;

  /// Whether the shop checks addresses against delivery areas at all.
  @JsonKey(fromJson: JsonReaders.boolTrue)
  final bool required;

  static int? _days(Object? value) => value is num ? value.toInt() : null;

  Map<String, dynamic> toJson() => _$DeliveryAreaModelToJson(this);

  DeliveryArea toEntity() => DeliveryArea(
    pincode: pincode.trim(),
    verdict: DeliveryVerdict.fromApi(status),
    city: city.trim(),
    state: state.trim(),
    charge: charge,
    minDeliveryDays: minDeliveryDays,
    freeDeliveryThreshold: freeDeliveryThreshold,
    priceMayVary: priceMayVary,
    zonesRequired: required,
  );
}
