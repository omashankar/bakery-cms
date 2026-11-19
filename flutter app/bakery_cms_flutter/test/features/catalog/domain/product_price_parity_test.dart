import 'dart:convert';
import 'dart:io';

import 'package:bakery_cms_flutter/features/catalog/data/models/product_model.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_modules.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_selection.dart';
import 'package:flutter_test/flutter_test.dart';

/// The app's price, struck price and option summary for EVERY live product,
/// size and shape-module setting, against what the WEBSITE's own functions
/// answer for the same data.
///
/// `test/fixtures/website/product_prices.json` was written by running
/// `calculateProductUnitPrice`, `displayCompareAtPrice`,
/// `defaultProductUnitPrice` and `formatVariantSummary`
/// (`features/products/lib/product-pricing.ts`) and `variantGroupsEnabledBy`
/// (`variant-utils.ts`) over `api_products.json` — the shop's real
/// `GET /api/products` answer, captured 2026-11-19 — plus one synthetic
/// product with a shape group, a priced default and a group with no default
/// (the live shop has no variant groups at all).
void main() {
  final fixture =
      jsonDecode(File('test/fixtures/website/product_prices.json').readAsStringSync())
          as Map<String, dynamic>;
  final live =
      (jsonDecode(File('test/fixtures/website/api_products.json').readAsStringSync())
              as Map<String, dynamic>)['products']
          as List<dynamic>;
  final products = <String, Product>{
    for (final json in [...live, ...fixture['synthetic'] as List<dynamic>])
      (json as Map<String, dynamic>)['slug'] as String: ProductModel.fromJson(json).toEntity(),
  };
  final cases = (fixture['cases'] as List<dynamic>).cast<Map<String, dynamic>>();

  test('the fixture covers every live product and the synthetic one', () {
    expect(products.length, live.length + 1);
    expect(cases.map((c) => c['slug']).toSet(), products.keys.toSet());
  });

  test('the product page: price and struck price per size, as the website', () {
    var checked = 0;
    for (final c in cases.where((c) => c['card'] != true)) {
      final product = products[c['slug']]!;
      final modules = ProductModules(shape: c['shapeModule'] as bool);
      final weight = product.weights.where((w) => w.label == c['weight']).firstOrNull;
      final selection = ProductSelection(
        product: product,
        weight: weight,
        variantSelections: (c['selections'] as Map<String, dynamic>).cast<String, String>(),
        modules: modules,
      );
      final where = '${c['slug']} @ ${c['weight']} shape=${c['shapeModule']} ${c['selections']}';
      expect(selection.unitPrice, (c['unitPrice'] as num).toDouble(), reason: where);
      expect(selection.compareAt, (c['compareAt'] as num?)?.toDouble(), reason: where);
      expect(
        selection.variantSummary,
        (c['summary'] as List<dynamic>).cast<String>(),
        reason: where,
      );
      // The cart line carries the struck price the customer was shown.
      expect(selection.toCartItem().compareAtPrice, selection.compareAt, reason: where);
      expect(selection.toCartItem().unitPrice, selection.unitPrice, reason: where);
      checked++;
    }
    expect(checked, greaterThan(300));
  });

  test('the listing card: price and struck price, as the website', () {
    for (final c in cases.where((c) => c['card'] == true)) {
      final product = products[c['slug']]!;
      final modules = ProductModules(shape: c['shapeModule'] as bool);
      final where = '${c['slug']} card shape=${c['shapeModule']}';
      expect(product.cardPriceWith(modules), (c['unitPrice'] as num).toDouble(), reason: where);
      expect(
        product.cardCompareAtWith(modules),
        (c['compareAt'] as num?)?.toDouble(),
        reason: where,
      );
    }
  });

  test('the live red-rose photo cake strikes ₹1,249 over ₹1,049, then moves with the size', () {
    final cake = products['red-rose-anniversary-couple-photo-cake']!;
    final first = ProductSelection.initial(cake);
    expect(first.unitPrice, 1049);
    expect(first.compareAt, 1249);
    final kilo = first.copyWith(weight: cake.weights[1]);
    expect(kilo.unitPrice, 1249);
    expect(kilo.compareAt, 1449);
    expect(kilo.toCartItem().compareAtPrice, 1449);
  });
}
