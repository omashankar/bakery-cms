import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_modules.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_selection.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_weight.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_group.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_option.dart';
import 'package:flutter_test/flutter_test.dart';

import '../catalog_fixtures.dart';

void main() {
  const cake = CatalogFixtures.truffleCake;

  /// A cake with a Shape group (+150 for a heart), a photo and two sizes.
  const shaped = Product(
    id: 'p-shaped',
    name: 'Shaped Photo Cake',
    slug: 'shaped-photo-cake',
    description: '',
    price: 800,
    compareAtPrice: 1000,
    images: [],
    categoryIds: [],
    occasionIds: [],
    weights: [
      ProductWeight(label: '0.5 kg', price: 800),
      ProductWeight(label: '1 kg', price: 1400),
    ],
    weightLabel: 'Weight',
    shapes: ['Round', 'Heart'],
    flavourOptions: ['Vanilla', 'Chocolate'],
    variantGroups: [
      VariantGroup(
        id: 'g-shape',
        name: 'Shape',
        required: true,
        type: VariantGroup.shape,
        options: [
          VariantOption(id: 'round', label: 'Round', priceAdjustment: 0),
          VariantOption(id: 'heart', label: 'Heart', priceAdjustment: 150, isDefault: true),
        ],
      ),
    ],
    descriptionBlocks: [],
    stockStatus: StockStatus.inStock,
    allowsPhotoUpload: true,
  );

  test('initial selection takes the first size and the default options, and no flavour', () {
    final selection = ProductSelection.initial(cake);
    expect(selection.weight, cake.weights.first);
    expect(selection.variantSelections, {'base': 'egg'});
    expect(selection.isComplete, isTrue);
    // The website never offers or sends the legacy flavour list.
    expect(selection.toCartItem().flavour, isNull);
    expect(selection.toCartItem().shape, isNull);
  });

  test('a product with several legacy flavours and shapes is still complete', () {
    expect(ProductSelection.initial(shaped).isComplete, isTrue);
    expect(ProductSelection.initial(shaped).toCartItem().flavour, isNull);
  });

  test('price follows the size and the variant surcharge', () {
    final selection = ProductSelection.initial(
      cake,
    ).copyWith(weight: cake.weights[1], variantSelections: {'base': 'eggless'}, quantity: 2);
    expect(selection.unitPrice, 999 + 50);
    expect(selection.lineTotal, (999 + 50) * 2);
  });

  test('the struck price moves with the size and the options', () {
    final base = ProductSelection.initial(cake);
    expect(base.compareAt, 699);
    // 1 Kg is ₹400 more than the base, so the strike is too.
    expect(base.copyWith(weight: cake.weights[1]).compareAt, 699 + 400);
    expect(
      base.copyWith(weight: cake.weights[1], variantSelections: {'base': 'eggless'}).compareAt,
      699 + 400 + 50,
    );
  });

  test('Shape off: the shape group is not offered, not priced and not on the line', () {
    final on = ProductSelection.initial(shaped);
    expect(on.unitPrice, 950);
    expect(on.visibleGroups, hasLength(1));
    expect(on.toCartItem().variantSummary, ['Shape: Heart']);

    final off = ProductSelection.initial(shaped, modules: const ProductModules(shape: false));
    expect(off.visibleGroups, isEmpty);
    expect(off.unitPrice, 800);
    expect(off.compareAt, 1000);
    final line = off.toCartItem();
    expect(line.variantSelections, isEmpty);
    expect(line.variantSummary, isEmpty);
    expect(line.unitPrice, 800);
  });

  test('Weight off: no size picker, the first size priced, no size on the line', () {
    final off = ProductSelection.initial(
      shaped,
      modules: const ProductModules(weight: false),
    ).copyWith(weight: shaped.weights[1]);
    expect(off.offersWeights, isFalse);
    expect(off.unitPrice, 800 + 150);
    final line = off.toCartItem();
    expect(line.weight, isNull);
    expect(line.weightLabel, isNull);
  });

  test('Photo Cake off: no photo offered and none on the line', () {
    final on = ProductSelection.initial(shaped).withPhoto(CatalogFixtures.photoUrl);
    expect(on.offersPhoto, isTrue);
    expect(on.toCartItem().photoUrl, CatalogFixtures.photoUrl);

    final off = on.copyWith(modules: const ProductModules(photoCake: false));
    expect(off.offersPhoto, isFalse);
    expect(off.toCartItem().photoUrl, isNull);
  });

  test('a single size is still offered, as the website shows it', () {
    expect(ProductSelection.initial(CatalogFixtures.photoCake).offersWeights, isTrue);
    expect(ProductSelection.initial(CatalogFixtures.pastry).offersWeights, isFalse);
  });

  test('an out-of-stock product cannot be added', () {
    expect(ProductSelection.initial(CatalogFixtures.soldOut).canAddToCart, isFalse);
  });

  test('toCartItem carries what the shop prices and restricts by', () {
    final item = ProductSelection.initial(
      cake,
    ).copyWith(message: '  Happy Birthday  ', variantSelections: {'base': 'eggless'}).toCartItem();
    expect(item.productSlug, cake.slug);
    expect(item.weight, '0.5 Kg');
    expect(item.message, 'Happy Birthday');
    // The website's `formatVariantSummary`: the group's name, then the option.
    expect(item.variantSummary, ['Base: Eggless']);
    expect(item.deliveryTierIds, ['standard', 'midnight']);
    expect(item.unitPrice, 649);
    expect(item.compareAtPrice, 749);
  });

  test('a blank message is not sent', () {
    final item = ProductSelection.initial(cake).copyWith(message: '   ').toCartItem();
    expect(item.message, isNull);
  });
}
