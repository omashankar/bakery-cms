import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/description_block.dart';

part 'description_block_model.g.dart';

@JsonSerializable(createToJson: false)
class DescriptionBlockModel {
  const DescriptionBlockModel({required this.id, required this.heading, required this.body});

  factory DescriptionBlockModel.fromJson(Map<String, dynamic> json) =>
      _$DescriptionBlockModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String heading;
  @JsonKey(fromJson: JsonReaders.string)
  final String body;

  DescriptionBlock toEntity() => DescriptionBlock(id: id, heading: heading, body: body);
}
