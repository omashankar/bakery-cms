import 'package:bakery_cms_flutter/core/error/server_exception.dart';
import 'package:bakery_cms_flutter/core/network/api_client.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/cart/domain/services/line_choices.dart';
import 'package:bakery_cms_flutter/features/checkout/data/datasources/checkout_remote_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/checkout/data/repositories/checkout_repository_impl.dart';
import 'package:bakery_cms_flutter/features/offers/domain/entities/offer_cart_line.dart';
import 'package:bakery_cms_flutter/features/orders/domain/entities/cancellation_class.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

/// Checkout reads the live catalogue the way the website's checkout route
/// does: published products only, occasion ids resolved to names, and the
/// three rules (cash on delivery, occasions, cancellation) derived from it.
void main() {
  late _MockApiClient client;

  setUp(() => client = _MockApiClient());

  CheckoutRepositoryImpl repository() =>
      CheckoutRepositoryImpl(CheckoutRemoteDataSourceImpl(client));

  void serves({required Object? products, Object? catalog}) {
    when(() => client.get('/api/products')).thenAnswer((_) async => {'products': products});
    when(() => client.get('/api/catalog')).thenAnswer((_) async {
      if (catalog == null) throw const ServerException(message: 'catalog down');
      return catalog;
    });
  }

  CartItem line(String slug, String name) =>
      CartItem(id: slug, productSlug: slug, name: name, image: '', unitPrice: 100, quantity: 1);

  test('published products only, with their occasions named', () async {
    serves(
      products: [
        {
          'slug': 'truffle-cake',
          'status': 'published',
          'occasionIds': ['o1', 'o2'],
          'codAllowed': false,
          'cancellationClass': 'made_to_order',
        },
        {
          'slug': 'draft-cake',
          'status': 'draft',
          'occasionIds': ['o3'],
        },
        {
          'slug': 'roses',
          'status': 'published',
          'occasionIds': ['o1'],
        },
      ],
      catalog: {
        'categories': <Object>[],
        'occasions': [
          {'id': 'o1', 'name': 'Birthday', 'isActive': true},
          {'id': 'o2', 'name': 'anniversary', 'isActive': false},
          {'id': 'o3', 'name': 'Diwali'},
        ],
      },
    );

    final catalog = (await repository().checkoutCatalog()).getRight().toNullable()!;

    expect(catalog.entries.keys, ['truffle-cake', 'roses']);
    // Every occasion any product is tagged with, once, sorted: Diwali only
    // tags a draft, so it is not offered.
    expect(catalog.occasionOptions, ['anniversary', 'Birthday']);
    expect(catalog.codBlockedBy([line('truffle-cake', 'Truffle'), line('roses', 'Roses')]), [
      'Truffle',
    ]);
    expect(catalog.codBlockedBy([line('gone', 'Gone')]), isEmpty, reason: 'unknown: not blocked');
    expect(catalog.policyClasses([line('roses', 'Roses'), line('truffle-cake', 'Truffle')]), [
      CancellationClass.madeToOrder,
      CancellationClass.standard,
    ]);
  });

  test('a catalogue that cannot be read costs the occasion names, never the products', () async {
    serves(
      products: [
        {
          'slug': 'truffle-cake',
          'status': 'published',
          'occasionIds': ['o1'],
          'codAllowed': false,
        },
      ],
    );

    final catalog = (await repository().checkoutCatalog()).getRight().toNullable()!;
    expect(catalog.occasionOptions, isEmpty);
    expect(catalog.entries['truffle-cake']?.codAllowed, isFalse);
  });

  test('cash on delivery is allowed unless the product says false', () async {
    serves(
      products: [
        {'slug': 'a', 'status': 'published'},
        {'slug': 'b', 'status': 'published', 'codAllowed': true},
      ],
      catalog: {'occasions': <Object>[]},
    );
    final catalog = (await repository().checkoutCatalog()).getRight().toNullable()!;
    expect(catalog.codBlockedBy([line('a', 'A'), line('b', 'B')]), isEmpty);
  });

  test('the availability answer: only a real boolean decides', () async {
    when(
      () => client.get('/api/razorpay/availability'),
    ).thenAnswer((_) async => {'configured': false, 'testMode': true});
    expect((await repository().onlinePaymentAvailable()).getRight().toNullable(), isFalse);

    when(() => client.get('/api/razorpay/availability')).thenAnswer((_) async => {'ok': 1});
    expect((await repository().onlinePaymentAvailable()).isRight(), isTrue);
    expect((await repository().onlinePaymentAvailable()).getRight().toNullable(), isNull);
  });

  group('line choices, labelled as cartLineChoices labels them', () {
    test('the size headed with the shop\'s word, or "Size"', () {
      expect(
        LineChoices.of(
          weight: '1 Kg',
          weightLabel: 'Weight',
          flavour: 'Chocolate',
          variantSummary: ['Egg: Eggless'],
        ),
        ['Weight: 1 Kg', 'Flavour: Chocolate', 'Egg: Eggless'],
      );
      expect(LineChoices.of(weight: 'M', weightLabel: ' '), ['Size: M']);
      expect(LineChoices.of(shape: '', variantSummary: const ['', 'Heart']), ['Heart']);
    });
  });

  test(
    'every category a product is filed under, for the coupon lines, legacy one folded in',
    () async {
      serves(
        products: [
          {
            'slug': 'truffle-cake',
            'status': 'published',
            'occasionIds': <Object>[],
            'categoryId': 'cakes',
            'categoryIds': ['cakes', 'chocolate'],
          },
          // A product saved before `categoryIds`: only the single category.
          {
            'slug': 'roses',
            'status': 'published',
            'occasionIds': <Object>[],
            'categoryId': 'flowers',
          },
          {'slug': 'card', 'status': 'published', 'occasionIds': <Object>[]},
        ],
      );

      final catalog = (await repository().checkoutCatalog()).getRight().toNullable()!;

      expect(catalog.entries['truffle-cake']!.categoryIds, ['cakes', 'chocolate']);
      expect(catalog.entries['roses']!.categoryIds, ['flowers']);
      expect(catalog.entries['card']!.categoryIds, isEmpty);
      const twoCakes = CartItem(
        id: 't',
        productSlug: 'truffle-cake',
        name: 'Truffle',
        image: '',
        unitPrice: 999,
        quantity: 2,
      );
      expect(catalog.offerLines([twoCakes, line('roses', 'Roses'), line('gone', 'Gone')]), const [
        OfferCartLine(price: 999, quantity: 2, categoryIds: ['cakes', 'chocolate']),
        OfferCartLine(price: 100, quantity: 1, categoryIds: ['flowers']),
        // Not in the catalogue: in no category, as on the website.
        OfferCartLine(price: 100, quantity: 1),
      ]);
    },
  );
}
