import 'package:bakery_cms_flutter/features/home_layout/data/models/home_layout_model.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/banner_layout.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/banners_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/categories_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/countdown_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/hero_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/products_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/promises_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/recently_viewed_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/section_tone.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/tabs_section.dart';
import 'package:flutter_test/flutter_test.dart';

/// `GET /api/storefront/home` read into sections the app can draw.
void main() {
  Map<String, dynamic> section(String type, Map<String, dynamic> fields) => {
    'id': '$type-1',
    'type': type,
    'background': 'white',
    'overline': null,
    'title': null,
    'description': null,
    'cta': null,
    ...fields,
  };

  List<Object> read(List<Map<String, dynamic>> sections) => HomeLayoutModel.fromJson({
    'updatedAt': '2026-11-18T00:00:00.000Z',
    'sections': sections,
  }).toEntity().sections;

  test('every type the shop publishes becomes its section, in order', () {
    final sections = read([
      section('hero', {
        'slides': [
          {'imageUrl': 'https://cdn.test/hero.jpg', 'mobileImageUrl': null, 'href': '/store'},
        ],
      }),
      section('promises', {
        'items': [
          {'kind': 'rating', 'title': '4.8 rating', 'subtitle': null},
        ],
      }),
      section('categories', {
        'categorySlugs': ['chocolate-cakes'],
      }),
      section('countdown', {
        'headline': 'Order now for today',
        'cutoffTime': '14:00',
        'timezone': 'Asia/Kolkata',
      }),
      section('banners', {
        'layout': 'strip',
        'shape': null,
        'items': [
          {
            'imageUrl': 'https://cdn.test/b.jpg',
            'title': 'Gifts',
            'href': '/store/collections/gifts',
          },
        ],
      }),
      section('products', {
        'productSlugs': ['chocolate-truffle-cake'],
      }),
      section('tabs', {
        'tabs': [
          {
            'label': 'Cakes',
            'href': null,
            'productSlugs': ['chocolate-truffle-cake'],
          },
        ],
      }),
      section('recently-viewed', {'maxCount': 8}),
    ]);

    expect(sections.map((s) => s.runtimeType), [
      HeroSection,
      PromisesSection,
      CategoriesSection,
      CountdownSection,
      BannersSection,
      ProductsSection,
      TabsSection,
      RecentlyViewedSection,
    ]);
    expect((sections[4] as BannersSection).layout, BannerLayout.strip);
    expect((sections[3] as CountdownSection).cutoffTime, '14:00');
  });

  test('a type this app does not know is skipped, not the page', () {
    final sections = read([
      section('testimonials', {}),
      section('products', {
        'productSlugs': ['a'],
      }),
    ]);
    expect(sections, hasLength(1));
  });

  test('a section with nothing in it is not drawn', () {
    final sections = read([
      section('hero', {'slides': <Object>[]}),
      section('products', {'productSlugs': <Object>[]}),
      section('banners', {
        'items': [
          {'imageUrl': '   '},
        ],
      }),
      section('countdown', {'headline': 'x', 'cutoffTime': '25:99'}),
      section('tabs', {
        'tabs': [
          {'label': 'Empty', 'productSlugs': <Object>[]},
        ],
      }),
    ]);
    expect(sections, isEmpty);
  });

  test('a shop path for a picture gets the shop\'s address in front', () {
    final hero =
        read([
              section('hero', {
                'slides': [
                  {'imageUrl': '/uploads/hero.jpg', 'mobileImageUrl': '/uploads/hero-phone.jpg'},
                ],
              }),
            ]).single
            as HeroSection;
    expect(hero.slides.single.imageUrl, endsWith('/uploads/hero.jpg'));
    expect(hero.slides.single.imageUrl, startsWith('http'));
    expect(hero.slides.single.phoneImageUrl, endsWith('/uploads/hero-phone.jpg'));
  });

  test('tone, heading and button come through; blanks become nothing', () {
    final products =
        read([
              {
                ...section('products', {
                  'productSlugs': ['a'],
                }),
                'background': 'panel-rose',
                'title': 'Best sellers',
                'overline': '  ',
                'cta': {'label': 'View all', 'href': '/store/collections'},
              },
            ]).single
            as ProductsSection;
    expect(products.tone, SectionTone.rose);
    expect(products.title, 'Best sellers');
    expect(products.overline, isNull);
    expect(products.cta?.label, 'View all');
  });

  test('a button with no address is dropped', () {
    final products =
        read([
              {
                ...section('products', {
                  'productSlugs': ['a'],
                }),
                'cta': {'label': 'View all', 'href': ''},
              },
            ]).single
            as ProductsSection;
    expect(products.cta, isNull);
  });
}
