import 'package:bakery_cms_flutter/app/router/app_routes.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/services/home_catalog_index.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/services/same_day_countdown.dart';
import 'package:bakery_cms_flutter/features/home_layout/presentation/utils/storefront_link.dart';
import 'package:flutter_test/flutter_test.dart';

import '../catalog/catalog_fixtures.dart';

void main() {
  final index = HomeCatalogIndex(
    products: CatalogFixtures.products,
    catalog: CatalogFixtures.catalog,
  );

  group('HomeCatalogIndex', () {
    test('keeps the shop\'s order, drops what is gone, and names each once', () {
      final products = index.products([
        'red-velvet-pastry',
        'deleted-cake',
        'chocolate-truffle-cake',
        'red-velvet-pastry',
      ]);
      expect(products.map((p) => p.slug), ['red-velvet-pastry', 'chocolate-truffle-cake']);
    });

    test('stops at max', () {
      expect(index.products(['red-velvet-pastry', 'chocolate-truffle-cake'], max: 1), hasLength(1));
    });

    test('finds a group by slug, a category before anything else', () {
      expect(index.groups(['birthday', 'nope', 'chocolate-cakes']).map((g) => g.slug), [
        'birthday',
        'chocolate-cakes',
      ]);
    });
  });

  group('StorefrontLink', () {
    String? route(String href) => StorefrontLink.route(href, index, base: 'https://shop.test');

    test('a product, a category, an occasion and a collection open their screens', () {
      expect(route('/store/p/chocolate-truffle-cake'), AppRoutes.product('chocolate-truffle-cake'));
      expect(
        route('/store/collections/chocolate-cakes'),
        AppRoutes.group('category', 'chocolate-cakes'),
      );
      expect(route('/store/collections/bestsellers'), AppRoutes.group('collection', 'bestsellers'));
      expect(route('/store/occasions/birthday'), AppRoutes.group('occasion', 'birthday'));
    });

    test('lists, the cart and searches open their tabs', () {
      expect(route('/store'), AppRoutes.home);
      expect(route('/store/collections'), AppRoutes.categories);
      expect(route('/store/departments/cakes'), AppRoutes.categories);
      expect(route('/store/cart'), AppRoutes.cart);
      expect(route('/store/collections?q=rose'), AppRoutes.searchFor('rose'));
    });

    test('the shop\'s own full address works; another site does not', () {
      expect(route('https://shop.test/store/p/x'), AppRoutes.product('x'));
      expect(route('https://elsewhere.test/store/p/x'), isNull);
    });

    test('a group the app does not hold, or a website-only page, opens nothing', () {
      expect(route('/store/collections/unknown'), isNull);
      expect(route('/store/pages/about'), isNull);
      expect(route(''), isNull);
    });
  });

  group('SameDayCountdown', () {
    test('counts to the cut-off on the same day', () {
      final left = SameDayCountdown.remaining('14:00', DateTime(2026, 11, 18, 11, 30));
      expect(left, const Duration(hours: 2, minutes: 30));
    });

    test('is over at and after the cut-off, never counting into tomorrow', () {
      expect(SameDayCountdown.remaining('14:00', DateTime(2026, 11, 18, 14)), isNull);
      expect(SameDayCountdown.remaining('14:00', DateTime(2026, 11, 18, 23)), isNull);
    });

    test('an unreadable time shows nothing', () {
      expect(SameDayCountdown.remaining('2pm', DateTime(2026, 11, 18, 9)), isNull);
    });
  });
}
