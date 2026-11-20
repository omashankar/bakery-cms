import 'dart:convert';
import 'dart:io';

import 'package:bakery_cms_flutter/features/catalog/data/models/catalog_model.dart';
import 'package:bakery_cms_flutter/features/catalog/data/models/product_model.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_group.dart';
import 'package:flutter_test/flutter_test.dart';

/// The small reading rules the website applies to the same API data.
void main() {
  Map<String, dynamic> product([Map<String, dynamic> extra = const {}]) => {
    'id': 'p-1',
    'name': 'Cake',
    'slug': 'cake',
    'price': 500,
    'status': 'published',
    ...extra,
  };

  group('allowsMessage', () {
    test('absent is TRUE: the website draws the box for allowsMessage !== false', () {
      expect(ProductModel.fromJson(product()).toEntity().allowsMessage, isTrue);
    });

    test('only an explicit false turns it off', () {
      expect(
        ProductModel.fromJson(product({'allowsMessage': false})).toEntity().allowsMessage,
        isFalse,
      );
      expect(
        ProductModel.fromJson(product({'allowsMessage': true})).toEntity().allowsMessage,
        isTrue,
      );
    });
  });

  test('the photo frame shape and a shape group type are read', () {
    final entity = ProductModel.fromJson(
      product({
        'photoFrameShape': 'heart',
        'variantGroups': [
          {
            'id': 'g1',
            'name': 'Shape',
            'type': 'shape',
            'required': true,
            'options': [
              {'id': 'o1', 'label': 'Round', 'priceAdjustment': 0, 'isDefault': true},
            ],
          },
          {
            'id': 'g2',
            'name': 'Topper',
            'options': [
              {'id': 'o2', 'label': 'Gold', 'priceAdjustment': 99},
            ],
          },
        ],
      }),
    ).toEntity();
    expect(entity.photoFrameShape, 'heart');
    expect(entity.variantGroups.first.isShape, isTrue);
    expect(entity.variantGroups.last.type, VariantGroup.custom);
    // No default named: nothing pre-chosen and nothing charged, as on the website.
    expect(entity.variantGroups.last.defaultOption, isNull);
    expect(entity.cardPrice, 500);
  });

  test('every live product reads, and the live flags come through', () {
    final live =
        (jsonDecode(File('test/fixtures/website/api_products.json').readAsStringSync())
                as Map<String, dynamic>)['products']
            as List<dynamic>;
    final products = [
      for (final json in live) ProductModel.fromJson(json as Map<String, dynamic>).toEntity(),
    ];
    expect(products, hasLength(live.length));
    final rose = products.firstWhere((p) => p.slug == 'red-rose-anniversary-couple-photo-cake');
    expect(rose.photoFrameShape, 'heart');
    expect(rose.allowsPhotoUpload, isTrue);
    expect(rose.compareAtPrice, 1049);
  });

  group('category order (the website\'s offeredRows)', () {
    List<String> order(List<Map<String, dynamic>> categories) => CatalogModel.fromJson({
      'categories': categories,
    }).toEntity().categories.map((c) => c.slug).toList();

    test('a row with no sortOrder sorts AFTER every numbered one', () {
      expect(
        order([
          {'id': '1', 'name': 'A', 'slug': 'unordered-a'},
          {'id': '2', 'name': 'B', 'slug': 'second', 'sortOrder': 2},
          {'id': '3', 'name': 'C', 'slug': 'unordered-c'},
          {'id': '4', 'name': 'D', 'slug': 'zeroth', 'sortOrder': 0},
        ]),
        ['zeroth', 'second', 'unordered-a', 'unordered-c'],
      );
    });

    test('ties keep the stored order, and the first row at a slug wins', () {
      expect(
        order([
          {'id': '1', 'name': 'Late', 'slug': 'cakes', 'sortOrder': 5},
          {'id': '2', 'name': 'First', 'slug': 'b', 'sortOrder': 1},
          {'id': '3', 'name': 'Second', 'slug': 'c', 'sortOrder': 1},
          {'id': '4', 'name': 'Early', 'slug': 'cakes', 'sortOrder': 0},
        ]),
        ['cakes', 'b', 'c'],
      );
      final kept = CatalogModel.fromJson({
        'categories': [
          {'id': '1', 'name': 'Late', 'slug': 'cakes', 'sortOrder': 5},
          {'id': '4', 'name': 'Early', 'slug': 'cakes', 'sortOrder': 0},
        ],
      }).toEntity().categories.single;
      expect(kept.name, 'Early');
    });

    test('switched-off rows are dropped', () {
      expect(
        order([
          {'id': '1', 'name': 'A', 'slug': 'a', 'isActive': false, 'sortOrder': 0},
          {'id': '2', 'name': 'B', 'slug': 'b'},
        ]),
        ['b'],
      );
    });
  });
}
