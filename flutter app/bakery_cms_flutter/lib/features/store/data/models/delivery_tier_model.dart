import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/delivery_tier.dart';

part 'delivery_tier_model.g.dart';

@JsonSerializable(createToJson: false)
class DeliveryTierModel {
  const DeliveryTierModel({
    required this.id,
    required this.label,
    required this.description,
    required this.fee,
    required this.windows,
  });

  factory DeliveryTierModel.fromJson(Map<String, dynamic> json) =>
      _$DeliveryTierModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String label;
  @JsonKey(fromJson: JsonReaders.string)
  final String description;
  @JsonKey(fromJson: JsonReaders.toDouble)
  final double fee;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> windows;

  DeliveryTier toEntity() =>
      DeliveryTier(id: id, label: label, description: description, fee: fee, windows: windows);
}
