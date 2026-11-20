import 'package:json_annotation/json_annotation.dart';

import '../../../../core/utils/json_readers.dart';
import '../../domain/entities/banner_layout.dart';
import '../../domain/entities/banners_section.dart';
import '../../domain/entities/categories_section.dart';
import '../../domain/entities/countdown_section.dart';
import '../../domain/entities/hero_section.dart';
import '../../domain/entities/home_section.dart';
import '../../domain/entities/products_section.dart';
import '../../domain/entities/promises_section.dart';
import '../../domain/entities/recently_viewed_section.dart';
import '../../domain/entities/section_tone.dart';
import '../../domain/entities/tabs_section.dart';
import 'home_banner_model.dart';
import 'home_category_tile_model.dart';
import 'home_link_model.dart';
import 'home_promise_model.dart';
import 'home_tab_model.dart';

part 'home_section_model.g.dart';

/// One section of `GET /api/storefront/home`. The fields of every type sit
/// side by side; [type] says which ones mean something. `items` is a banner
/// list in a `banners` section and a promise list in a `promises` one, so it
/// is kept raw and read by type.
@JsonSerializable(createToJson: false)
class HomeSectionModel {
  const HomeSectionModel({
    required this.id,
    required this.type,
    required this.background,
    this.overline,
    this.title,
    this.description,
    this.cta,
    this.slides = const [],
    this.items = const [],
    this.categorySlugs = const [],
    this.productSlugs = const [],
    this.tabs = const [],
    this.headline,
    this.cutoffTime,
    this.timezone,
    this.layout,
    this.shape,
    this.maxCount = 0,
  });

  factory HomeSectionModel.fromJson(Map<String, dynamic> json) => _$HomeSectionModelFromJson(json);

  @JsonKey(fromJson: JsonReaders.string)
  final String id;
  @JsonKey(fromJson: JsonReaders.string)
  final String type;
  @JsonKey(fromJson: JsonReaders.string)
  final String background;
  final String? overline;
  final String? title;
  final String? description;
  @JsonKey(fromJson: _link)
  final HomeLinkModel? cta;
  @JsonKey(fromJson: _banners)
  final List<HomeBannerModel> slides;
  @JsonKey(fromJson: _maps)
  final List<Map<String, dynamic>> items;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> categorySlugs;
  @JsonKey(fromJson: JsonReaders.strings)
  final List<String> productSlugs;
  @JsonKey(fromJson: _tabs)
  final List<HomeTabModel> tabs;
  final String? headline;
  final String? cutoffTime;
  final String? timezone;
  final String? layout;
  final String? shape;
  @JsonKey(fromJson: JsonReaders.toInt)
  final int maxCount;

  static const String _defaultTimezone = 'Asia/Kolkata';

  /// The section the app can draw, or null: a type this version does not
  /// know, or one that arrived with nothing in it.
  HomeSection? toEntity() {
    final tone = SectionTone.fromApi(background);
    final overline = _text(this.overline);
    final title = _text(this.title);
    final description = _text(this.description);
    final cta = this.cta?.toEntity();

    switch (type) {
      case 'hero':
        final slides = [for (final slide in this.slides) ?slide.toEntity()];
        return slides.isEmpty
            ? null
            : HeroSection(
                id: id,
                slides: slides,
                tone: tone,
                overline: overline,
                title: title,
                description: description,
                cta: cta,
              );
      case 'promises':
        final promises = [for (final item in items) ?HomePromiseModel.fromJson(item).toEntity()];
        return promises.isEmpty
            ? null
            : PromisesSection(
                id: id,
                items: promises,
                tone: tone,
                overline: overline,
                title: title,
                description: description,
                cta: cta,
              );
      case 'categories':
        return categorySlugs.isEmpty
            ? null
            : CategoriesSection(
                id: id,
                categorySlugs: categorySlugs,
                tiles: [for (final item in items) ?HomeCategoryTileModel.fromJson(item).toEntity()],
                tone: tone,
                overline: overline,
                title: title,
                description: description,
                cta: cta,
              );
      case 'countdown':
        final cutoff = _text(cutoffTime);
        return cutoff == null || !_clockTime.hasMatch(cutoff)
            ? null
            : CountdownSection(
                id: id,
                headline: _text(headline) ?? title ?? '',
                cutoffTime: cutoff,
                timezone: _text(timezone) ?? _defaultTimezone,
                tone: tone,
                overline: overline,
                title: title,
                description: description,
                cta: cta,
              );
      case 'banners':
        final banners = [for (final item in items) ?HomeBannerModel.fromJson(item).toEntity()];
        return banners.isEmpty
            ? null
            : BannersSection(
                id: id,
                layout: BannerLayout.fromApi(layout),
                items: banners,
                shape: _text(shape),
                tone: tone,
                overline: overline,
                title: title,
                description: description,
                cta: cta,
              );
      case 'products':
        return productSlugs.isEmpty
            ? null
            : ProductsSection(
                id: id,
                productSlugs: productSlugs,
                tone: tone,
                overline: overline,
                title: title,
                description: description,
                cta: cta,
              );
      case 'tabs':
        final tabs = [for (final tab in this.tabs) ?tab.toEntity()];
        return tabs.isEmpty
            ? null
            : TabsSection(
                id: id,
                tabs: tabs,
                tone: tone,
                overline: overline,
                title: title,
                description: description,
                cta: cta,
              );
      case 'recently-viewed':
        return maxCount <= 0
            ? null
            : RecentlyViewedSection(
                id: id,
                maxCount: maxCount,
                tone: tone,
                overline: overline,
                title: title,
                description: description,
                cta: cta,
              );
      default:
        return null;
    }
  }

  static final RegExp _clockTime = RegExp(r'^([01]\d|2[0-3]):[0-5]\d$');

  static String? _text(String? value) =>
      (value == null || value.trim().isEmpty) ? null : value.trim();

  static HomeLinkModel? _link(Object? value) =>
      value is Map<String, dynamic> ? HomeLinkModel.fromJson(value) : null;

  static List<Map<String, dynamic>> _maps(Object? value) => [
    if (value is List)
      for (final item in value)
        if (item is Map<String, dynamic>) item,
  ];

  static List<HomeBannerModel> _banners(Object? value) => [
    for (final item in _maps(value)) HomeBannerModel.fromJson(item),
  ];

  static List<HomeTabModel> _tabs(Object? value) => [
    for (final item in _maps(value)) HomeTabModel.fromJson(item),
  ];
}
