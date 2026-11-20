import 'package:flutter/foundation.dart';
import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/home_layout.dart';
import 'home_menu_item_model.dart';
import 'home_section_model.dart';

part 'home_layout_model.g.dart';

/// `GET /api/storefront/home`: the published home page.
@JsonSerializable(createToJson: false)
class HomeLayoutModel {
  const HomeLayoutModel({required this.updatedAt, required this.sections, this.menu = const []});

  factory HomeLayoutModel.fromJson(Map<String, dynamic> json) => _$HomeLayoutModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String updatedAt;
  @JsonKey(fromJson: _sections)
  final List<HomeSectionModel> sections;

  /// The website header's top-level items. Missing on an older server.
  @JsonKey(fromJson: _menu)
  final List<HomeMenuItemModel> menu;

  HomeLayout toEntity() => HomeLayout(
    updatedAt: updatedAt,
    sections: [for (final section in sections) ?section.toEntity()],
    menu: [for (final item in menu) ?item.toEntity()],
  );

  /// One section the app cannot read is skipped, not the whole page.
  static List<HomeSectionModel> _sections(Object? value) {
    final read = <HomeSectionModel>[];
    if (value is! List) return read;
    for (final item in value.whereType<Map<String, dynamic>>()) {
      try {
        read.add(HomeSectionModel.fromJson(item));
      } catch (error) {
        debugPrint('Skipped a home section that could not be read: $error');
      }
    }
    return read;
  }

  static List<HomeMenuItemModel> _menu(Object? value) => value is List
      ? value.whereType<Map<String, dynamic>>().map(HomeMenuItemModel.fromJson).toList()
      : const [];
}
