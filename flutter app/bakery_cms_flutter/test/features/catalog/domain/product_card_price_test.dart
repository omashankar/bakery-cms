import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_weight.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_group.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_option.dart';
import 'package:flutter_test/flutter_test.dart';

/// A listing card shows the website's three numbers: the first weight with
/// the default options, the "was" price moved by the same amount, and only
/// a real discount (`defaultProductUnitPrice` / `displayCompareAtPrice`).
void main() {
  Product cake({double? compareAt, bool egglessDefault = false}) => Product(
    id: 'p',
    name: 'Caramel Cake',
    slug: 'caramel-cake',
    description: '',
    price: 999,
    compareAtPrice: compareAt,
    images: const [],
    categoryIds: const [],
    occasionIds: const [],
    weights: const [
      ProductWeight(label: '0.5 Kg', price: 999),
      ProductWeight(label: '1 Kg', price: 1799),
    ],
    shapes: const [],
    flavourOptions: const [],
    variantGroups: [
      VariantGroup(
        id: 'base',
        name: 'Base',
        required: true,
        options: [
          VariantOption(id: 'egg', label: 'Egg', priceAdjustment: 0, isDefault: !egglessDefault),
          VariantOption(
            id: 'eggless',
            label: 'Eggless',
            priceAdjustment: 50,
            isDefault: egglessDefault,
          ),
        ],
      ),
    ],
    descriptionBlocks: const [],
    stockStatus: StockStatus.inStock,
    deliveryTierIds: const [],
  );

  test('the first weight with the default options, and its was-price', () {
    final product = cake(compareAt: 1249);
    expect(product.cardPrice, 999);
    expect(product.cardCompareAt, 1249);
  });

  test('a default option that costs more moves both numbers together', () {
    final product = cake(compareAt: 1249, egglessDefault: true);
    expect(product.cardPrice, 1049);
    expect(product.cardCompareAt, 1299);
  });

  test('a was-price at or under the base is not a discount', () {
    expect(cake(compareAt: 999).cardCompareAt, isNull);
    expect(cake(compareAt: 899).cardCompareAt, isNull);
    expect(cake().cardCompareAt, isNull);
  });
}
