import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/features/home_layout/data/models/home_section_model.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/hero_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/services/home_catalog_index.dart';
import 'package:bakery_cms_flutter/features/home_layout/presentation/widgets/hero_carousel.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../catalog/catalog_fixtures.dart';

/// A WORDED hero slide, as `/api/storefront/home` sends it
/// (`StorefrontHomeHeroSlide`): the badge, the headline, the line under it,
/// the button and the second button — drawn the way the website's
/// `hero-carousel.tsx` draws them.
void main() {
  final index = HomeCatalogIndex(
    products: CatalogFixtures.products,
    catalog: CatalogFixtures.catalog,
  );

  HeroSection hero(Map<String, Object?> slide) =>
      HomeSectionModel.fromJson({
            'id': 'hero-0',
            'type': 'hero',
            'background': 'white',
            'slides': [
              {
                'imageUrl': 'https://res.cloudinary.com/demo/image/upload/v1/hero.webp',
                'mobileImageUrl': null,
                'imageAlt': null,
                ...slide,
              },
            ],
          }).toEntity()!
          as HeroSection;

  const worded = {
    'title': 'Make Their Birthday Sweeter',
    'subtitle': 'Freshly baked, delivered today',
    'ctaLabel': 'Shop Cakes',
    'href': '/store/collections/birthday',
    'badge': 'Same-day delivery',
    'secondaryCtaLabel': 'See occasions',
    'secondaryHref': '/store/collections',
  };

  test('the extra hero fields are read from the live shape', () {
    final slide = hero(worded).slides.single;
    expect(slide.badge, 'Same-day delivery');
    expect(slide.secondaryCtaLabel, 'See occasions');
    expect(slide.secondaryHref, '/store/collections');
    expect(slide.hasSecondaryCta, isTrue);
  });

  test('a second button needs both its words and its link', () {
    final slide = hero({...worded, 'secondaryHref': '  '}).slides.single;
    expect(slide.secondaryCtaLabel, isNull);
    expect(slide.hasSecondaryCta, isFalse);
  });

  test('artwork slides (the live shop) carry none of them', () {
    final slide = hero({
      'title': null,
      'ctaLabel': null,
      'href': '/store/collections',
      'badge': null,
      'secondaryCtaLabel': null,
      'secondaryHref': null,
    }).slides.single;
    expect(slide.badge, isNull);
    expect(slide.hasSecondaryCta, isFalse);
  });

  // `FilledButton.icon` is a private subclass, so match by type test.
  Finder filled(String label) => find.ancestor(
    of: find.text(label),
    matching: find.byWidgetPredicate((widget) => widget is FilledButton),
  );

  Future<void> pump(WidgetTester tester, HeroSection section) => tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      home: Scaffold(
        body: HeroCarousel(slides: section.slides, index: index),
      ),
    ),
  );

  testWidgets('a worded slide draws the badge, the words and both buttons', (tester) async {
    await pump(tester, hero(worded));
    expect(find.text('Same-day delivery'), findsOneWidget);
    expect(find.text('Make Their Birthday Sweeter'), findsOneWidget);
    expect(find.text('Freshly baked, delivered today'), findsOneWidget);
    expect(filled('Shop Cakes'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, 'See occasions'), findsOneWidget);
  });

  testWidgets('a worded slide with no badge or second button draws neither', (tester) async {
    await pump(
      tester,
      hero({...worded, 'badge': null, 'secondaryCtaLabel': null, 'secondaryHref': null}),
    );
    expect(find.text('Same-day delivery'), findsNothing);
    expect(find.byType(OutlinedButton), findsNothing);
    expect(filled('Shop Cakes'), findsOneWidget);
  });
}
