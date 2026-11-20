import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/image_url.dart';
import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/home_category_tile.dart';

part 'home_category_tile_model.g.dart';

@JsonSerializable(createToJson: false)
class HomeCategoryTileModel {
  const HomeCategoryTileModel({
    required this.slug,
    required this.name,
    required this.imageUrl,
    this.priceLabel,
  });

  factory HomeCategoryTileModel.fromJson(Map<String, dynamic> json) =>
      _$HomeCategoryTileModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String slug;
  @JsonKey(fromJson: JsonReaders.string)
  final String name;
  @JsonKey(fromJson: JsonReaders.string)
  final String imageUrl;
  final String? priceLabel;

  HomeCategoryTile? toEntity() => slug.trim().isEmpty || name.trim().isEmpty
      ? null
      : HomeCategoryTile(
          slug: slug.trim(),
          name: name.trim(),
          imageUrl: ImageUrl.resolve(imageUrl),
          priceLabel: (priceLabel ?? '').trim().isEmpty ? null : priceLabel!.trim(),
        );
}
