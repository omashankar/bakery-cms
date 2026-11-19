import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/variant_option.dart';

part 'variant_option_model.g.dart';

@JsonSerializable(createToJson: false)
class VariantOptionModel {
  const VariantOptionModel({
    required this.id,
    required this.label,
    required this.priceAdjustment,
    required this.isDefault,
  });

  factory VariantOptionModel.fromJson(Map<String, dynamic> json) =>
      _$VariantOptionModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String label;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double priceAdjustment;
  @JsonKey(fromJson: JsonReaders.boolOr)
  final bool isDefault;

  VariantOption toEntity() =>
      VariantOption(id: id, label: label, priceAdjustment: priceAdjustment, isDefault: isDefault);
}
