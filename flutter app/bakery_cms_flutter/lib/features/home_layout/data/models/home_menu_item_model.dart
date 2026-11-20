import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/image_url.dart';
import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/home_menu_item.dart';

part 'home_menu_item_model.g.dart';

/// One `data.menu` item of `GET /api/storefront/home`: a top-level item of
/// the website's header menu.
@JsonSerializable(createToJson: false)
class HomeMenuItemModel {
  const HomeMenuItemModel({required this.label, required this.href, required this.imageUrl});

  factory HomeMenuItemModel.fromJson(Map<String, dynamic> json) =>
      _$HomeMenuItemModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String label;
  @JsonKey(fromJson: JsonReaders.string)
  final String href;

  /// Null on the wire when the item has no picture; read as "".
  @JsonKey(fromJson: JsonReaders.string)
  final String imageUrl;

  /// Null when either the words or the address is missing: a tab with no
  /// name or nowhere to go is not drawn.
  HomeMenuItem? toEntity() => label.trim().isEmpty || href.trim().isEmpty
      ? null
      : HomeMenuItem(label: label.trim(), href: href.trim(), imageUrl: ImageUrl.resolve(imageUrl));
}
