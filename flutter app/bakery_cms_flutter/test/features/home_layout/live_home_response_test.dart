import 'dart:convert';
import 'dart:io';

import 'package:bakery_cms_flutter/core/network/api_envelope.dart';
import 'package:bakery_cms_flutter/features/home_layout/data/models/home_layout_model.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/banners_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/categories_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/countdown_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/hero_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_menu_item.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/products_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/promises_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/recently_viewed_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/tabs_section.dart';
import 'package:flutter_test/flutter_test.dart';

/// The shop's real `GET /api/storefront/home` answer (captured 2026-11-18),
/// read end to end: if the server's shape and the app's reading of it drift
/// apart, this goes red rather than the home page going quietly empty.
///
/// Re-captured at 15:36 IST with `data.menu`. The countdown band is answered
/// for the moment of the request and is gone after the 14:00 cutoff, so the
/// morning capture's countdown section is kept in its place (every other
/// section was byte-identical between the two captures).
void main() {
  Map<String, dynamic> live() {
    final raw = File('test/fixtures/storefront_home.json').readAsStringSync();
    return ApiEnvelope.unwrap(jsonDecode(raw)) as Map<String, dynamic>;
  }

  test('the live header menu reads into icon tabs, in the website order', () {
    final menu = HomeLayoutModel.fromJson(live()).toEntity().menu;
    expect(menu.map((item) => item.label), [
      'All Categories',
      'Cakes',
      'Pastries',
      'Occasions',
      'Birthday',
      'Specials',
    ]);
    expect(menu.first, const HomeMenuItem(label: 'All Categories', href: '/store/collections'));
    expect(menu.every((item) => item.href.startsWith('/store')), isTrue);
    // A picture where the linked group has one, none where it does not.
    expect(menu.where((item) => item.imageUrl.startsWith('https://')), hasLength(4));
    expect(menu.where((item) => item.imageUrl.isEmpty).map((item) => item.label), [
      'All Categories',
      'Specials',
    ]);
  });

  test('the live published home page reads into every section, in order', () {
    final sections = HomeLayoutModel.fromJson(live()).toEntity().sections;

    expect(sections.map((s) => s.runtimeType), [
      HeroSection,
      PromisesSection,
      CategoriesSection,
      CountdownSection,
      BannersSection,
      ProductsSection,
      TabsSection,
      BannersSection,
      ProductsSection,
      BannersSection,
      ProductsSection,
      ProductsSection,
      RecentlyViewedSection,
    ]);

    final hero = sections.first as HeroSection;
    expect(hero.slides, hasLength(3));
    expect(hero.slides.every((s) => s.href != null && s.imageAlt != null), isTrue);

    final menu = sections[2] as CategoriesSection;
    expect(menu.tiles.map((t) => t.slug), menu.categorySlugs);
    expect(menu.tiles.every((t) => t.imageUrl.startsWith('http')), isTrue);

    final grid = sections[4] as BannersSection;
    expect(grid.items.every((b) => b.aspectRatio != null), isTrue);

    final tabs = sections[6] as TabsSection;
    expect(tabs.tabs, hasLength(3));
    expect(tabs.tabs.every((t) => t.productSlugs.isNotEmpty), isTrue);
  });
}
