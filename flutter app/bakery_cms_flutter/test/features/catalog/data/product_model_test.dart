import 'package:bakery_cms_flutter/features/catalog/data/models/catalog_model.dart';
import 'package:bakery_cms_flutter/features/catalog/data/models/product_model.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:flutter_test/flutter_test.dart';

/// Shapes copied from the live `GET /api/products` and `GET /api/catalog`.
void main() {
  test('reads a real product, folding the legacy categoryId in', () {
    final product = ProductModel.fromJson(const {
      'id': 'product-005c',
      'name': 'Dark Chocolate Mousse Pastry',
      'slug': 'dark-chocolate-mousse-pastry',
      'description': 'Indulge',
      'price': 179,
      'compareAtPrice': 229,
      'images': ['https://res.cloudinary.com/x/image/upload/v1/a.webp', ''],
      'categoryId': 'cat-f61a',
      'categoryIds': <String>[],
      'occasionIds': <String>[],
      'deliveryTierIds': ['standard', 'midnight', 'fixed-time'],
      'weights': [
        {'label': '1.5 Kg', 'price': 999},
        {'label': '2.5 kg', 'price': 1299.5},
      ],
      'weightLabel': 'Weight',
      'status': 'published',
      'shapes': <String>[],
      'flavourOptions': ['Dark Chocolate Mousse'],
      'stockStatus': 'in_stock',
      'allowsMessage': false,
      'variantGroups': <Object>[],
      'descriptionBlocks': [
        {'id': 'blk-1', 'heading': 'Product Details', 'body': 'Flavour: Dark'},
        {'id': 'blk-2', 'heading': 'Empty', 'body': '  '},
      ],
      'rating': 0,
      'reviewCount': 0,
    }).toEntity();

    expect(product.categoryIds, ['cat-f61a']);
    expect(product.images, hasLength(1));
    expect(product.weights.last.price, 1299.5);
    expect(product.fromPrice, 999);
    expect(product.compareAtPrice, 229);
    expect(product.descriptionBlocks, hasLength(1));
    expect(product.stockStatus, StockStatus.inStock);
    expect(product.codAllowed, isTrue, reason: 'COD unless the product says otherwise');
  });

  test('a document missing most fields still reads', () {
    final product = ProductModel.fromJson(const {'id': 'p', 'slug': 'p', 'name': 'P'}).toEntity();
    expect(product.price, 0);
    expect(product.weights, isEmpty);
    expect(product.isAvailable, isTrue);
  });

  test('the catalog hides inactive groups and sorts occasions', () {
    final catalog = CatalogModel.fromJson(const {
      'categories': [
        {'id': 'c1', 'name': 'Cakes', 'slug': 'cakes', 'isActive': true},
        {'id': 'c2', 'name': 'Hidden', 'slug': 'hidden', 'isActive': false},
      ],
      'occasions': [
        {'id': 'o2', 'name': 'Anniversary', 'slug': 'anniversary', 'sortOrder': 2},
        {'id': 'o1', 'name': 'Birthday', 'slug': 'birthday', 'sortOrder': 0},
      ],
      'collections': [
        {
          'id': 'col',
          'name': 'Bestsellers',
          'slug': 'bestsellers',
          'productIds': ['p1'],
        },
      ],
    }).toEntity();

    expect(catalog.categories.map((c) => c.slug), ['cakes']);
    expect(catalog.occasions.map((o) => o.slug), ['birthday', 'anniversary']);
    expect(catalog.collections.single.productIds, ['p1']);
  });
}
