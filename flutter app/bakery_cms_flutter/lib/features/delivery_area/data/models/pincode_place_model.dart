import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/pincode_place.dart';

part 'pincode_place_model.g.dart';

/// One `place` in the answer of `GET /api/pincodes?codes=324001`:
/// `{pincode, state, districts, areas}`.
@JsonSerializable(createToJson: false)
class PincodePlaceModel {
  const PincodePlaceModel({
    required this.pincode,
    required this.state,
    this.districts = const [],
    this.areas = const [],
  });

  factory PincodePlaceModel.fromJson(Map<String, dynamic> json) =>
      _$PincodePlaceModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String pincode;
  @JsonKey(fromJson: JsonReaders.string)
  final String state;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> districts;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> areas;

  PincodePlace toEntity() => PincodePlace(
    pincode: pincode.trim(),
    state: state.trim(),
    districts: [
      for (final district in districts)
        if (district.trim().isNotEmpty) district.trim(),
    ],
    areas: areas,
  );
}
