import 'package:bakery_cms_flutter/features/catalog/domain/entities/listing_filter.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/listing_sort.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/price_band.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_modules.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_weight.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/stock_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_group.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/variant_option.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/services/listing_arranger.dart';
import 'package:flutter_test/flutter_test.dart';

Product _product(
  String slug, {
  double price = 100,
  bool bestSeller = false,
  double rating = 0,
  int reviews = 0,
  StockStatus stock = StockStatus.inStock,
}) => Product(
  id: slug,
  name: slug,
  slug: slug,
  description: '',
  price: price,
  images: const [],
  categoryIds: const [],
  occasionIds: const [],
  weights: const [],
  shapes: const [],
  flavourOptions: const [],
  variantGroups: const [],
  descriptionBlocks: const [],
  stockStatus: stock,
  isBestSeller: bestSeller,
  rating: rating,
  reviewCount: reviews,
);

const ProductModules _all = ProductModules.all;

List<String> _slugs(List<Product> products) => [for (final p in products) p.slug];

void main() {
  // In the listing's own order: the order a tie must keep.
  final plain = _product('plain', price: 450);
  final liked = _product('liked', price: 1200, rating: 4.5, reviews: 40);
  final oneFiveStar = _product('one-five-star', price: 999, rating: 5, reviews: 1);
  final best = _product('best', price: 2500, bestSeller: true);
  final soldOut = _product('sold-out', price: 500, stock: StockStatus.outOfStock);
  final twin = _product('twin', price: 450);
  final all = [plain, liked, oneFiveStar, best, soldOut, twin];

  group('sort', () {
    test('popularity: best sellers, then rating × reviews, then the listing order', () {
      expect(_slugs(ListingArranger.arrange(all, modules: _all)), [
        'best',
        'liked', // 4.5 × 40 beats one five-star review
        'one-five-star',
        'plain',
        'sold-out',
        'twin',
      ]);
    });

    test('price low to high, by the card price; equal prices keep their order', () {
      expect(
        _slugs(ListingArranger.arrange(all, modules: _all, sort: ListingSort.priceLowToHigh)),
        ['plain', 'twin', 'sold-out', 'one-five-star', 'liked', 'best'],
      );
    });

    test('price high to low; equal prices still keep their order', () {
      expect(
        _slugs(ListingArranger.arrange(all, modules: _all, sort: ListingSort.priceHighToLow)),
        ['best', 'liked', 'one-five-star', 'sold-out', 'plain', 'twin'],
      );
    });

    test('never changes the list it was given', () {
      final copy = [...all];
      ListingArranger.arrange(all, modules: _all, sort: ListingSort.priceHighToLow);
      expect(all, copy);
    });
  });

  group('filter', () {
    List<String> filtered(ListingFilter filter) => _slugs(
      ListingArranger.arrange(all, modules: _all, sort: ListingSort.priceLowToHigh, filter: filter),
    );

    test('no filter keeps everything', () {
      expect(filtered(const ListingFilter()), hasLength(all.length));
    });

    test('under ₹500', () {
      expect(filtered(const ListingFilter(priceBands: {PriceBand.under500})), ['plain', 'twin']);
    });

    test('₹500 – ₹1,000 includes ₹500 and stops short of ₹1,000', () {
      expect(filtered(const ListingFilter(priceBands: {PriceBand.from500To1000})), [
        'sold-out',
        'one-five-star',
      ]);
    });

    test('₹1,000 – ₹2,000', () {
      expect(filtered(const ListingFilter(priceBands: {PriceBand.from1000To2000})), ['liked']);
    });

    test('above ₹2,000', () {
      expect(filtered(const ListingFilter(priceBands: {PriceBand.above2000})), ['best']);
    });

    test('two bands keep a product in either', () {
      expect(filtered(const ListingFilter(priceBands: {PriceBand.under500, PriceBand.above2000})), [
        'plain',
        'twin',
        'best',
      ]);
    });

    test('every price is in exactly one band, boundaries included', () {
      for (final price in [0.0, 499.99, 500.0, 999.0, 1000.0, 1999.5, 2000.0, 9000.0]) {
        expect(PriceBand.values.where((band) => band.contains(price)), hasLength(1));
      }
      expect(PriceBand.from1000To2000.contains(1000), isTrue);
      expect(PriceBand.above2000.contains(2000), isTrue);
      expect(PriceBand.from1000To2000.contains(2000), isFalse);
    });

    test('in stock only drops what is sold out', () {
      expect(filtered(const ListingFilter(inStockOnly: true)), isNot(contains('sold-out')));
      expect(filtered(const ListingFilter(inStockOnly: true)), hasLength(all.length - 1));
    });

    test('4★ & above keeps rated products only, never an unreviewed one', () {
      expect(filtered(const ListingFilter(fourStarAndAbove: true)), ['one-five-star', 'liked']);
      final lowRated = _product('low', rating: 3.9, reviews: 12);
      final ratedNoReviews = _product('ghost', rating: 4.8);
      expect(
        ListingArranger.arrange(
          [lowRated, ratedNoReviews],
          modules: _all,
          filter: const ListingFilter(fourStarAndAbove: true),
        ),
        isEmpty,
      );
    });

    test('filters combine: all of them must hold', () {
      expect(
        filtered(
          const ListingFilter(
            priceBands: {PriceBand.from500To1000},
            inStockOnly: true,
            fourStarAndAbove: true,
          ),
        ),
        ['one-five-star'],
      );
    });

    test('the price is the card price, default options included, not the base price', () {
      // ₹480 at its base, ₹530 with the default ₹50 option: what the card shows.
      const withExtra = Product(
        id: 'extra',
        name: 'extra',
        slug: 'extra',
        description: '',
        price: 480,
        images: [],
        categoryIds: [],
        occasionIds: [],
        weights: [],
        shapes: [],
        flavourOptions: [],
        variantGroups: [
          VariantGroup(
            id: 'base',
            name: 'Base',
            required: true,
            options: [
              VariantOption(id: 'eggless', label: 'Eggless', priceAdjustment: 50, isDefault: true),
            ],
          ),
        ],
        descriptionBlocks: [],
        stockStatus: StockStatus.inStock,
      );
      final under = ListingArranger.arrange(
        [withExtra],
        modules: _all,
        filter: const ListingFilter(priceBands: {PriceBand.under500}),
      );
      final band = ListingArranger.arrange(
        [withExtra],
        modules: _all,
        filter: const ListingFilter(priceBands: {PriceBand.from500To1000}),
      );
      expect(under, isEmpty);
      expect(_slugs(band), ['extra']);
      // And sorts by it: ₹530 comes after a plain ₹500.
      expect(
        _slugs(
          ListingArranger.arrange(
            [withExtra, _product('flat', price: 500)],
            modules: _all,
            sort: ListingSort.priceLowToHigh,
          ),
        ),
        ['flat', 'extra'],
      );
    });
  });

  group('modules: the price the card shows is the price it sorts and filters by', () {
    // ₹900 at its first size (the base ₹700 is not what it sells for), with a
    // default Heart shape at +₹200: ₹1,100 in a shop that sells shapes, ₹900
    // in one that has switched Shape off.
    const shaped = Product(
      id: 'shaped',
      name: 'shaped',
      slug: 'shaped',
      description: '',
      price: 700,
      images: [],
      categoryIds: [],
      occasionIds: [],
      weights: [
        ProductWeight(label: '1 Kg', price: 900),
        ProductWeight(label: '2 Kg', price: 1700),
      ],
      shapes: [],
      flavourOptions: [],
      variantGroups: [
        VariantGroup(
          id: 'shape',
          name: 'Shape',
          required: true,
          type: VariantGroup.shape,
          options: [
            VariantOption(id: 'heart', label: 'Heart', priceAdjustment: 200, isDefault: true),
          ],
        ),
      ],
      descriptionBlocks: [],
      stockStatus: StockStatus.inStock,
    );
    final flat = _product('flat', price: 1000);
    const shapeOff = ProductModules(shape: false);
    const weightAndShapeOff = ProductModules(weight: false, shape: false);

    List<String> lowToHigh(ProductModules modules) => _slugs(
      ListingArranger.arrange([shaped, flat], modules: modules, sort: ListingSort.priceLowToHigh),
    );
    List<String> inBand(PriceBand band, ProductModules modules) => _slugs(
      ListingArranger.arrange(
        [shaped, flat],
        modules: modules,
        filter: ListingFilter(priceBands: {band}),
      ),
    );

    test('every module on: the shape surcharge is in the card price, so it sorts after ₹1,000', () {
      expect(shaped.cardPriceWith(_all), 1100);
      expect(lowToHigh(_all), ['flat', 'shaped']);
      expect(
        _slugs(
          ListingArranger.arrange([shaped, flat], modules: _all, sort: ListingSort.priceHighToLow),
        ),
        ['shaped', 'flat'],
      );
      expect(inBand(PriceBand.from1000To2000, _all), ['shaped', 'flat']);
      expect(inBand(PriceBand.from500To1000, _all), isEmpty);
    });

    test('Shape off: the card shows ₹900, so it sorts first and sits in ₹500 – ₹1,000', () {
      expect(shaped.cardPriceWith(shapeOff), 900);
      expect(lowToHigh(shapeOff), ['shaped', 'flat']);
      expect(
        _slugs(
          ListingArranger.arrange(
            [shaped, flat],
            modules: shapeOff,
            sort: ListingSort.priceHighToLow,
          ),
        ),
        ['flat', 'shaped'],
      );
      expect(inBand(PriceBand.from500To1000, shapeOff), ['shaped']);
      expect(inBand(PriceBand.from1000To2000, shapeOff), ['flat']);
    });

    test('Weight off still prices the first size, as the website'
        's card does', () {
      expect(shaped.cardPriceWith(weightAndShapeOff), 900);
      expect(lowToHigh(weightAndShapeOff), ['shaped', 'flat']);
      expect(inBand(PriceBand.from500To1000, weightAndShapeOff), ['shaped']);
      expect(inBand(PriceBand.under500, weightAndShapeOff), isEmpty); // never the ₹700 base
    });
  });

  group('ListingFilter', () {
    test('counts one per ticked choice', () {
      expect(const ListingFilter().activeCount, 0);
      expect(const ListingFilter().isEmpty, isTrue);
      expect(
        const ListingFilter(
          priceBands: {PriceBand.under500, PriceBand.above2000},
          inStockOnly: true,
          fourStarAndAbove: true,
        ).activeCount,
        4,
      );
    });

    test('toggleBand ticks and unticks', () {
      final ticked = const ListingFilter().toggleBand(PriceBand.under500);
      expect(ticked.priceBands, {PriceBand.under500});
      expect(ticked.toggleBand(PriceBand.under500).priceBands, isEmpty);
    });
  });

  test('hasRatings: only when some product has a review', () {
    expect(ListingArranger.hasRatings([plain, best]), isFalse);
    expect(ListingArranger.hasRatings([plain, liked]), isTrue);
  });
}
