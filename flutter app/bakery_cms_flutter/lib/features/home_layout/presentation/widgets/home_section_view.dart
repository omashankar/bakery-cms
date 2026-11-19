import 'package:flutter/material.dart';

import '../../../../core/constants/strings/home_strings.dart';
import '../../../catalog/domain/entities/product.dart';
import '../../domain/entities/banners_section.dart';
import '../../domain/entities/categories_section.dart';
import '../../domain/entities/countdown_section.dart';
import '../../domain/entities/hero_section.dart';
import '../../domain/entities/home_category_tile.dart';
import '../../domain/entities/home_section.dart';
import '../../domain/entities/home_tab.dart';
import '../../domain/entities/products_section.dart';
import '../../domain/entities/promises_section.dart';
import '../../domain/entities/recently_viewed_section.dart';
import '../../domain/entities/tabs_section.dart';
import '../../domain/services/home_catalog_index.dart';
import 'banner_band.dart';
import 'category_grid.dart';
import 'countdown_band.dart';
import 'hero_carousel.dart';
import 'home_product_row.dart';
import 'promises_strip.dart';
import 'section_band.dart';
import 'tabs_band.dart';

/// One published home section, drawn from the products and groups the app
/// holds. A section that comes to nothing here (its products all hidden
/// since, no recent views yet) is not drawn at all, as on the website.
class HomeSectionView extends StatelessWidget {
  const HomeSectionView({
    super.key,
    required this.section,
    required this.index,
    this.recentSlugs = const [],
  });

  final HomeSection section;
  final HomeCatalogIndex index;
  final List<String> recentSlugs;

  @override
  Widget build(BuildContext context) {
    final section = this.section;
    final Widget? body = switch (section) {
      HeroSection(:final slides) => HeroCarousel(slides: slides, index: index),
      PromisesSection(:final items) => PromisesStrip(items: items),
      CategoriesSection(:final categorySlugs, :final tiles) => _categories(categorySlugs, tiles),
      CountdownSection() => CountdownBand(section: section, index: index),
      BannersSection() => BannerBand(section: section, index: index),
      ProductsSection(:final productSlugs) => _products(index.products(productSlugs)),
      TabsSection(:final tabs) => _tabs(tabs),
      RecentlyViewedSection(:final maxCount) => _products(
        index.products(recentSlugs, max: maxCount),
      ),
      _ => null,
    };
    if (body == null) return const SizedBox.shrink();

    // The hero and the countdown carry their own words.
    final headed = section is! HeroSection && section is! CountdownSection;
    return SectionBand(
      section: section is RecentlyViewedSection && section.title == null
          ? RecentlyViewedSection(
              id: section.id,
              maxCount: section.maxCount,
              tone: section.tone,
              overline: section.overline,
              title: HomeStrings.recentlyViewed,
              description: section.description,
              cta: section.cta,
            )
          : section,
      index: index,
      showHeading: headed,
      child: body,
    );
  }

  /// The shop's own tiles; from a shop that sends none, the categories the
  /// app holds for those slugs, under their own names and pictures.
  Widget? _categories(List<String> slugs, List<HomeCategoryTile> tiles) {
    final shown = tiles.isNotEmpty
        ? tiles
        : [
            for (final group in index.groups(slugs))
              HomeCategoryTile(slug: group.slug, name: group.name, imageUrl: group.image),
          ];
    return shown.isEmpty ? null : CategoryGrid(tiles: shown, index: index);
  }

  static Widget? _products(List<Product> products) =>
      products.isEmpty ? null : HomeProductRow(products: products);

  Widget? _tabs(List<HomeTab> tabs) {
    final resolved = [
      for (final tab in tabs)
        if (index.products(tab.productSlugs) case final products when products.isNotEmpty)
          (label: tab.label, products: products),
    ];
    return resolved.isEmpty ? null : TabsBand(tabs: resolved);
  }
}
