import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/constants/strings/home_strings.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_link.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_tab.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/products_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/recently_viewed_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/section_tone.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/tabs_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/services/home_catalog_index.dart';
import 'package:bakery_cms_flutter/features/home_layout/presentation/widgets/home_section_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../catalog/app_cubits_harness.dart';
import '../catalog/catalog_fixtures.dart';

void main() {
  final index = HomeCatalogIndex(
    products: CatalogFixtures.products,
    catalog: CatalogFixtures.catalog,
  );

  Future<void> pump(WidgetTester tester, HomeSection section, {List<String> recent = const []}) =>
      tester.pumpWidget(
        // The card reads the shop's settings, the wishlist and the delivery
        // PIN code; settings not in yet, as before they arrive.
        withAppCubits(
          settingsLoaded: false,
          MaterialApp(
            theme: AppTheme.light,
            home: Scaffold(
              body: SingleChildScrollView(
                child: HomeSectionView(section: section, index: index, recentSlugs: recent),
              ),
            ),
          ),
        ),
      );

  testWidgets('a product row shows the shop\'s products under its own title', (tester) async {
    await pump(
      tester,
      const ProductsSection(
        id: 'best',
        title: 'Best sellers',
        productSlugs: ['red-velvet-pastry', 'chocolate-truffle-cake'],
      ),
    );
    expect(find.text('Best sellers'), findsOneWidget);
    expect(find.text(CatalogFixtures.pastry.name), findsOneWidget);
    expect(find.text(CatalogFixtures.truffleCake.name), findsOneWidget);
  });

  testWidgets('a row whose products are all gone is not drawn, title included', (tester) async {
    await pump(
      tester,
      const ProductsSection(id: 'gone', title: 'Gone', productSlugs: ['deleted-cake']),
    );
    expect(find.text('Gone'), findsNothing);
  });

  testWidgets('"View all" on a tinted band is one line on a pill of that tint', (tester) async {
    await pump(
      tester,
      const ProductsSection(
        id: 'best',
        title: 'Best sellers',
        tone: SectionTone.rose,
        cta: HomeLink(label: 'View all', href: '/store/collections/bestsellers'),
        productSlugs: ['red-velvet-pastry'],
      ),
    );
    final label = tester.widget<Text>(find.text('View all'));
    expect(label.maxLines, 1);
    expect(find.byType(TextButton), findsOneWidget);
  });

  testWidgets('a button the app cannot follow is not drawn', (tester) async {
    await pump(
      tester,
      const ProductsSection(
        id: 'best',
        title: 'Best sellers',
        cta: HomeLink(label: 'About us', href: '/store/pages/about'),
        productSlugs: ['red-velvet-pastry'],
      ),
    );
    expect(find.text('About us'), findsNothing);
  });

  testWidgets('recently viewed shows this phone\'s history, and nothing without one', (
    tester,
  ) async {
    const section = RecentlyViewedSection(id: 'recent', maxCount: 4);
    await pump(tester, section);
    expect(find.text(HomeStrings.recentlyViewed), findsNothing);

    await pump(tester, section, recent: ['chocolate-truffle-cake']);
    expect(find.text(HomeStrings.recentlyViewed), findsOneWidget);
    expect(find.text(CatalogFixtures.truffleCake.name), findsOneWidget);
  });

  testWidgets('tabs switch the row; a tab with nothing left is dropped', (tester) async {
    await pump(
      tester,
      const TabsSection(
        id: 'tabs',
        title: 'Pick one',
        tabs: [
          HomeTab(label: 'Cakes', productSlugs: ['chocolate-truffle-cake']),
          HomeTab(label: 'Gone', productSlugs: ['deleted-cake']),
          HomeTab(label: 'Pastries', productSlugs: ['red-velvet-pastry']),
        ],
      ),
    );
    expect(find.text('Gone'), findsNothing);
    expect(find.text(CatalogFixtures.truffleCake.name), findsOneWidget);

    await tester.tap(find.text('Pastries'));
    await tester.pump();
    expect(find.text(CatalogFixtures.pastry.name), findsOneWidget);
    expect(find.text(CatalogFixtures.truffleCake.name), findsNothing);
  });
}
