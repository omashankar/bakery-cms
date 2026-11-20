import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/pin_check_result.dart';
import '../../domain/entities/pin_found.dart';
import '../../domain/entities/pin_region.dart';
import '../../domain/entities/pin_status.dart';

part 'pin_check_model.g.dart';

/// `POST /api/checkout/delivery-pin` (with a pin) → `data`: both answers
/// `checkDeliveryPinController` writes, the eligible one and the refusal.
@JsonSerializable(createToJson: false)
class PinCheckModel {
  const PinCheckModel({
    required this.status,
    this.message,
    this.charge,
    this.city,
    this.state,
    this.postalCode,
    this.formattedAddress,
    this.minDeliveryDays,
    this.freeDeliveryThreshold,
    this.region,
    this.pincodeSure = false,
    this.otherPincodes = const [],
    this.cityNote,
    this.field,
    this.found,
    this.kmToArea,
  });

  factory PinCheckModel.fromJson(Map<String, dynamic> json) => _$PinCheckModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String status;
  @JsonKey(fromJson: _text)
  final String? message;
  @JsonKey(fromJson: JsonReaders.toDoubleOrNull)
  final double? charge;
  @JsonKey(fromJson: _text)
  final String? city;
  @JsonKey(fromJson: _text)
  final String? state;
  @JsonKey(fromJson: _text)
  final String? postalCode;
  @JsonKey(fromJson: _text)
  final String? formattedAddress;
  @JsonKey(fromJson: _days)
  final int? minDeliveryDays;
  @JsonKey(fromJson: _number)
  final double? freeDeliveryThreshold;
  @JsonKey(fromJson: _region)
  final PinRegion? region;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool pincodeSure;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> otherPincodes;
  @JsonKey(fromJson: _text)
  final String? cityNote;
  @JsonKey(fromJson: _text)
  final String? field;
  @JsonKey(fromJson: _found)
  final PinFound? found;
  @JsonKey(fromJson: _number)
  final double? kmToArea;

  static int? _days(Object? value) => value is num ? value.toInt() : null;

  static double? _number(Object? value) => value is num ? value.toDouble() : null;

  /// A blank string is no answer: the server sends "" for none.
  static String? _text(Object? value) => value is String && value.trim().isNotEmpty ? value : null;

  static PinRegion? _region(Object? value) => value is Map
      ? PinRegion(state: _text(value['state']), districts: JsonReaders.strings(value['districts']))
      : null;

  static PinFound? _found(Object? value) => value is Map
      ? PinFound(
          postalCode: _text(value['postalCode']),
          city: _text(value['city']),
          state: _text(value['state']),
          formattedAddress: _text(value['formattedAddress']),
        )
      : null;

  PinCheckResult toEntity() => PinCheckResult(
    status: PinStatus.fromApi(status),
    message: message,
    charge: charge,
    city: city,
    state: state,
    postalCode: postalCode,
    formattedAddress: formattedAddress,
    minDeliveryDays: minDeliveryDays,
    freeDeliveryThreshold: freeDeliveryThreshold,
    region: region,
    pincodeSure: pincodeSure,
    otherPincodes: otherPincodes,
    cityNote: cityNote,
    field: field,
    found: found,
    kmToArea: kmToArea,
  );
}
