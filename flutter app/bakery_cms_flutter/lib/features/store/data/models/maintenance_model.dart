import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';

part 'maintenance_model.g.dart';

@JsonSerializable(createToJson: false)
class MaintenanceModel {
  const MaintenanceModel({required this.isEnabled, required this.message});

  factory MaintenanceModel.fromJson(Map<String, dynamic> json) => _$MaintenanceModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool isEnabled;
  @JsonKey(fromJson: JsonReaders.string)
  final String message;
}
