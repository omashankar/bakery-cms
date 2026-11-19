import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/variant_group.dart';
import 'variant_option_model.dart';

part 'variant_group_model.g.dart';

@JsonSerializable(createToJson: false)
class VariantGroupModel {
  const VariantGroupModel({
    required this.id,
    required this.name,
    required this.required,
    required this.options,
    required this.type,
  });

  factory VariantGroupModel.fromJson(Map<String, dynamic> json) =>
      _$VariantGroupModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String name;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool required;
  @JsonKey(defaultValue: <VariantOptionModel>[])
  final List<VariantOptionModel> options;

  /// `shape` or `custom`; absent on older groups, which are custom.
  @JsonKey(fromJson: JsonReaders.string)
  final String type;

  VariantGroup toEntity() => VariantGroup(
    id: id,
    name: name,
    required: required,
    options: options.map((option) => option.toEntity()).toList(),
    type: type == VariantGroup.shape ? VariantGroup.shape : VariantGroup.custom,
  );
}
