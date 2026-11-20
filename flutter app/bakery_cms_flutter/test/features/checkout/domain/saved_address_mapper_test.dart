import 'package:bakery_cms_flutter/features/addresses/domain/entities/saved_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/entities/checkout_address.dart';
import 'package:bakery_cms_flutter/features/checkout/domain/services/saved_address_mapper.dart';
import 'package:flutter_test/flutter_test.dart';

/// The second number and the country travel with a saved address both ways,
/// as the website's `toCheckoutAddress` carries them: a field forgotten here
/// "compiles perfectly and blanks itself the moment a returning customer
/// taps their saved address" (checkout-page.tsx).
void main() {
  const saved = SavedAddress(
    id: 'a1',
    fullName: 'Asha Verma',
    phone: '9876543210',
    addressLine1: '12 Park Road',
    city: 'Kota',
    state: 'Rajasthan',
    pincode: '324001',
    altPhone: ' 9123456780 ',
    country: 'India',
  );

  test('choosing a saved address fills the second number and the country', () {
    final filled = SavedAddressMapper.toCheckout(
      saved,
      current: const CheckoutAddress(email: 'asha@example.com'),
      keepLocation: false,
    );
    expect(filled.altPhone, '9123456780');
    expect(filled.country, 'India');
  });

  test('an older saved address without them gives blanks, not nulls', () {
    final filled = SavedAddressMapper.toCheckout(
      const SavedAddress(addressLine1: 'x'),
      current: const CheckoutAddress(),
      keepLocation: false,
    );
    expect(filled.altPhone, '');
    expect(filled.country, '');
  });

  test('the address an order went to keeps them in the book; blanks stay out', () {
    final kept = SavedAddressMapper.fromCheckout(
      const CheckoutAddress(addressLine1: '12 Park Road', altPhone: '9123456780', country: 'India'),
    );
    expect(kept.altPhone, '9123456780');
    expect(kept.country, 'India');

    final bare = SavedAddressMapper.fromCheckout(const CheckoutAddress(altPhone: ' '));
    expect(bare.altPhone, isNull);
    expect(bare.country, isNull);
  });
}
