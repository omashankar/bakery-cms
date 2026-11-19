import 'package:bakery_cms_flutter/features/cart/data/models/cart_item_model.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/checkout/data/models/order_line_model.dart';
import 'package:bakery_cms_flutter/features/checkout/data/models/quote_line_model.dart';
import 'package:flutter_test/flutter_test.dart';

/// The photo on a photo-cake line: kept on the phone with the cart, and sent
/// with the quote and the order only when there is one (the shop's schema
/// takes a missing field but refuses `null`).
void main() {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/bakery-cms/photo-cakes/a.jpg';

  CartItem line({String? photoUrl}) => CartItem(
        id: CartItem.keyFor(productSlug: 'photo-cake', weight: '1 Kg', photoUrl: photoUrl),
        productSlug: 'photo-cake',
        name: 'Photo Cake',
        image: '',
        unitPrice: 899,
        quantity: 1,
        weight: '1 Kg',
        photoUrl: photoUrl,
      );

  group('the saved cart', () {
    test('keeps the photo through a restart', () {
      final saved = CartItemModel.fromEntity(line(photoUrl: url)).toJson();

      expect(saved['photoUrl'], url);
      expect(CartItemModel.fromJson(saved).toEntity(), line(photoUrl: url));
    });

    test('a line with no photo stores no photo key', () {
      final saved = CartItemModel.fromEntity(line()).toJson();

      expect(saved.containsKey('photoUrl'), isFalse);
      expect(CartItemModel.fromJson(saved).toEntity().photoUrl, isNull);
    });

    test('a cart saved before photos existed still loads', () {
      final saved = CartItemModel.fromEntity(line()).toJson()..remove('photoUrl');

      expect(CartItemModel.fromJson(saved).toEntity(), line());
    });
  });

  group('checkout lines', () {
    test('the quote line carries the photo', () {
      expect(QuoteLineModel.fromEntity(line(photoUrl: url)).toJson()['photoUrl'], url);
    });

    test('the order line carries the photo', () {
      expect(OrderLineModel.fromEntity(line(photoUrl: url)).toJson()['photoUrl'], url);
    });

    test('neither sends a photo key when there is none', () {
      expect(QuoteLineModel.fromEntity(line()).toJson().containsKey('photoUrl'), isFalse);
      expect(OrderLineModel.fromEntity(line()).toJson().containsKey('photoUrl'), isFalse);
    });
  });
}
