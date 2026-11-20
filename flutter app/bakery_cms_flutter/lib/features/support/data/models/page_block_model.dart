import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/page_block.dart';
import '../../domain/entities/page_block_type.dart';

part 'page_block_model.g.dart';

@JsonSerializable(createToJson: false)
class PageBlockModel {
  const PageBlockModel({required this.id, required this.type, required this.content});

  factory PageBlockModel.fromJson(Map<String, dynamic> json) => _$PageBlockModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String type;
  @JsonKey(fromJson: JsonReaders.string)
  final String content;

  PageBlock toEntity() =>
      PageBlock(id: id, type: PageBlockType.fromApi(type), content: content.trim());
}
