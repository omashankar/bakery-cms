import 'package:bakery_cms_flutter/app/router/app_routes.dart';
import 'package:bakery_cms_flutter/app/theme/app_theme.dart';
import 'package:bakery_cms_flutter/core/widgets/app_network_image.dart';
import 'package:bakery_cms_flutter/features/home_layout/data/models/home_layout_model.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_menu_item.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/services/home_catalog_index.dart';
import 'package:bakery_cms_flutter/features/home_layout/presentation/widgets/home_menu_tabs.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import '../catalog/catalog_fixtures.dart';

/// The website header's menu, as icon tabs under the home search box.
void main() {
  final index = HomeCatalogIndex(
    products: CatalogFixtures.products,
    catalog: CatalogFixtures.catalog,
  );

  const cakes = HomeMenuItem(
    label: 'Cakes',
    href: '/store/collections/chocolate-cakes',
    imageUrl: 'https://cdn.test/cakes.webp',
  );
  const all = HomeMenuItem(label: 'All Categories', href: '/store/collections');

  group('reading data.menu', () {
    List<HomeMenuItem> read(Object? menu) => HomeLayoutModel.fromJson({
      'updatedAt': '2026-11-18T00:00:00.000Z',
      'sections': const <Object>[],
      'menu': menu,
    }).toEntity().menu;

    test('every item with words and an address, in order; a null picture reads as none', () {
      expect(
        read([
          {'label': 'All Categories', 'href': '/store/collections', 'imageUrl': null},
          {
            'label': ' Cakes ',
            'href': '/store/collections/chocolate-cakes',
            'imageUrl': 'https://cdn.test/cakes.webp',
          },
        ]),
        [all, cakes],
      );
    });

    test('an item with no words or nowhere to go is left out, not the whole menu', () {
      expect(
        read([
          {'label': '', 'href': '/store/collections'},
          {'label': 'Cakes', 'href': '  '},
          'not an item',
          {'label': 'All Categories', 'href': '/store/collections', 'imageUrl': 7},
        ]),
        [all],
      );
    });

    test('a shop path picture gets the shop address in front', () {
      final menu = read([
        {'label': 'Cakes', 'href': '/store/collections/cakes', 'imageUrl': '/uploads/cakes.png'},
      ]);
      expect(menu.single.imageUrl, endsWith('/uploads/cakes.png'));
      expect(menu.single.imageUrl, startsWith('http'));
    });

    test('an older server with no menu reads as an empty menu', () {
      final layout = HomeLayoutModel.fromJson({
        'updatedAt': '',
        'sections': const <Object>[],
      }).toEntity();
      expect(layout.menu, isEmpty);
      expect(read('nonsense'), isEmpty);
    });
  });

  group('HomeMenuTabs', () {
    late List<String> opened;

    Future<void> pump(WidgetTester tester, List<HomeMenuItem> items) {
      opened = [];
      final router = GoRouter(
        routes: [
          GoRoute(
            path: AppRoutes.home,
            builder: (_, _) => Scaffold(
              body: HomeMenuTabs(items: items, index: index),
            ),
          ),
          GoRoute(
            path: AppRoutes.groupPattern,
            builder: (_, state) {
              opened.add(state.uri.path);
              return const Scaffold();
            },
          ),
          GoRoute(
            path: AppRoutes.categories,
            builder: (_, state) {
              opened.add(state.uri.path);
              return const Scaffold();
            },
          ),
        ],
      );
      addTearDown(router.dispose);
      return tester.pumpWidget(MaterialApp.router(theme: AppTheme.light, routerConfig: router));
    }

    testWidgets('an empty menu draws nothing at all', (tester) async {
      await pump(tester, const []);
      expect(find.byType(InkWell), findsNothing);
      expect(tester.getSize(find.byType(HomeMenuTabs)).height, 0);
    });

    testWidgets('each item is a tab: its picture, or an icon when it has none, over its name', (
      tester,
    ) async {
      await pump(tester, const [all, cakes]);
      expect(find.text('All Categories'), findsOneWidget);
      expect(find.text('Cakes'), findsOneWidget);
      expect(find.byType(AppNetworkImage), findsOneWidget);
      expect(find.byIcon(Icons.grid_view_rounded), findsOneWidget);
    });

    testWidgets("a tap opens the app screen behind the item's website address", (tester) async {
      await pump(tester, const [all, cakes]);
      await tester.tap(find.text('Cakes'));
      await tester.pumpAndSettle();
      expect(opened, [AppRoutes.group('category', 'chocolate-cakes')]);
    });
  });
}
