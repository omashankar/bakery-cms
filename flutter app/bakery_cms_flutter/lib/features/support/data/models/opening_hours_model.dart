import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/opening_hours.dart';

part 'opening_hours_model.g.dart';

@JsonSerializable(createToJson: false)
class OpeningHoursModel {
  const OpeningHoursModel({required this.day, required this.hours});

  factory OpeningHoursModel.fromJson(Map<String, dynamic> json) =>
      _$OpeningHoursModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String day;
  @JsonKey(fromJson: JsonReaders.string)
  final String hours;

  OpeningHours toEntity() => OpeningHours(day: day.trim(), hours: hours.trim());
}
