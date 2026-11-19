import 'package:bakery_cms_flutter/features/catalog/domain/entities/catalog.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/group_kind.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_group.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_weight.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_group.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_option.dart';

/// Shared test data for the catalog feature.
abstract final class CatalogFixtures {
  static const String chocolateId = 'cat-chocolate';
  static const String birthdayId = 'oc-birthday';

  static const Product truffleCake = Product(
    id: 'p-truffle',
    name: 'Chocolate Truffle Cake',
    slug: 'chocolate-truffle-cake',
    description: 'Rich dark chocolate truffle',
    price: 599,
    compareAtPrice: 699,
    images: ['https://res.cloudinary.com/demo/image/upload/v1/truffle.webp'],
    categoryIds: [chocolateId],
    occasionIds: [birthdayId],
    weights: [
      ProductWeight(label: '0.5 Kg', price: 599),
      ProductWeight(label: '1 Kg', price: 999),
    ],
    shapes: [],
    flavourOptions: ['Truffle'],
    variantGroups: [
      VariantGroup(
        id: 'base',
        name: 'Base',
        required: true,
        options: [
          VariantOption(id: 'egg', label: 'Egg', priceAdjustment: 0, isDefault: true),
          VariantOption(id: 'eggless', label: 'Eggless', priceAdjustment: 50),
        ],
      ),
    ],
    descriptionBlocks: [],
    stockStatus: StockStatus.inStock,
    deliveryTierIds: ['standard', 'midnight'],
    isBestSeller: true,
    allowsMessage: true,
  );

  static const Product pastry = Product(
    id: 'p-pastry',
    name: 'Red Velvet Pastry',
    slug: 'red-velvet-pastry',
    description: 'A single slice of red velvet',
    price: 149,
    images: [],
    categoryIds: ['cat-pastries'],
    occasionIds: [],
    weights: [],
    shapes: [],
    flavourOptions: [],
    variantGroups: [],
    descriptionBlocks: [],
    stockStatus: StockStatus.inStock,
    codAllowed: false,
  );

  static const Product soldOut = Product(
    id: 'p-sold-out',
    name: 'Mango Cheesecake',
    slug: 'mango-cheesecake',
    description: 'Seasonal',
    price: 899,
    images: [],
    categoryIds: [chocolateId],
    occasionIds: [],
    weights: [],
    shapes: [],
    flavourOptions: [],
    variantGroups: [],
    descriptionBlocks: [],
    stockStatus: StockStatus.outOfStock,
  );

  /// Not in [products]: only the photo tests use it.
  static const Product photoCake = Product(
    id: 'p-photo',
    name: 'Photo Cake',
    slug: 'photo-cake',
    description: 'Your picture, printed on the cake',
    price: 899,
    images: [],
    categoryIds: [chocolateId],
    occasionIds: [],
    weights: [ProductWeight(label: '1 Kg', price: 899)],
    shapes: [],
    flavourOptions: [],
    variantGroups: [],
    descriptionBlocks: [],
    stockStatus: StockStatus.inStock,
    allowsPhotoUpload: true,
  );

  static const String photoUrl =
      'https://res.cloudinary.com/demo/image/upload/v1/bakery-cms/photo-cakes/a.jpg';

  static const List<Product> products = [truffleCake, pastry, soldOut];

  static const ProductGroup chocolate = ProductGroup(
    id: chocolateId,
    name: 'Chocolate Cakes',
    slug: 'chocolate-cakes',
    kind: GroupKind.category,
  );

  static const ProductGroup birthday = ProductGroup(
    id: birthdayId,
    name: 'Birthday',
    slug: 'birthday',
    kind: GroupKind.occasion,
  );

  static const ProductGroup bestsellers = ProductGroup(
    id: 'col-best',
    name: 'Bestsellers',
    slug: 'bestsellers',
    kind: GroupKind.collection,
    // Out of catalogue order, and naming one product that no longer exists.
    productIds: ['p-pastry', 'p-gone', 'p-truffle'],
  );

  static const Catalog catalog = Catalog(
    categories: [chocolate],
    occasions: [birthday],
    collections: [bestsellers],
  );
}
