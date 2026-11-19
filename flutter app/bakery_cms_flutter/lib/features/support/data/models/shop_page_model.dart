import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/shop_page.dart';
import 'page_block_model.dart';

part 'shop_page_model.g.dart';

/// `GET /api/storefront/pages/[slug]`: `{slug, title, description, blocks:
/// [{id, type, content}]}`, a published page only.
@JsonSerializable(createToJson: false)
class ShopPageModel {
  const ShopPageModel({
    required this.slug,
    required this.title,
    required this.description,
    required this.blocks,
  });

  factory ShopPageModel.fromJson(Map<String, dynamic> json) => _$ShopPageModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String slug;
  @JsonKey(fromJson: JsonReaders.string)
  final String title;
  @JsonKey(fromJson: JsonReaders.string)
  final String description;
  @JsonKey(fromJson: _blocks)
  final List<PageBlockModel> blocks;

  static List<PageBlockModel> _blocks(Object? value) => value is List
      ? value.whereType<Map<String, dynamic>>().map(PageBlockModel.fromJson).toList()
      : const [];

  ShopPage toEntity() => ShopPage(
    slug: slug,
    title: title.trim(),
    description: description.trim(),
    blocks: blocks
        .map((block) => block.toEntity())
        .where((block) => block.content.isNotEmpty)
        .toList(),
  );
}
