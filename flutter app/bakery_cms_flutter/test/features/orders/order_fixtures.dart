/// An order as `GET /api/customer-auth/orders` answers it (shape of the
/// shop's `PlacedOrder`, staff-only fields removed).
Map<String, dynamic> orderJson({
  String orderNumber = 'BK-20261116-4821',
  String status = 'pending',
  String placedAt = '2026-11-16T10:15:00.000Z',
  String? policyClass = 'standard',
  List<Map<String, dynamic>>? statusHistory,
}) {
  return {
    'id': 'order-$orderNumber',
    'orderNumber': orderNumber,
    'items': [
      {
        'id': 'line-1',
        'productSlug': 'caramel-butterscotch-cake',
        'name': 'Caramel Butterscotch Cake',
        'image': 'https://res.cloudinary.com/demo/image/upload/v1/bakery-cms/cake.webp',
        'price': 999,
        'quantity': 1,
        'weight': '1.5 Kg',
        'weightLabel': 'Weight',
        'flavour': 'Caramel Butterscotch',
        'message': 'Happy Birthday Riya',
        'variantSummary': ['Eggless'],
      },
      {
        'productSlug': 'dark-chocolate-mousse-pastry',
        'name': 'Dark Chocolate Mousse Pastry',
        'image': '',
        'price': 179.0,
        'quantity': 2,
      },
    ],
    'totals': {
      'subtotal': 1357,
      'delivery': 0,
      'tax': 67.85,
      'discount': 100,
      'platformCharge': 0,
      'giftWrapFee': 49,
      'deliveryTierFee': 150,
      'deliveryTierLabel': 'Fixed Time Delivery',
      'taxLabel': 'GST (5%)',
      'total': 1523.85,
      'itemCount': 3,
    },
    'address': {
      'fullName': 'Riya Sharma',
      'email': 'riya@example.com',
      'phone': '9876543210',
      'addressLine1': '12 Park Road',
      'landmark': 'Near the temple',
      'city': 'Kota',
      'state': 'Rajasthan',
      'pincode': '324001',
      'addressLabel': 'Home',
      'location': {'lat': 25.18, 'lng': 75.83},
    },
    'paymentMethod': 'cod',
    'paymentStatus': 'cod',
    'status': status,
    'statusHistory': statusHistory ?? [
      {'status': 'pending', 'at': placedAt},
    ],
    'placedAt': placedAt,
    'estimatedDelivery': '2026-11-17T10:15:00.000Z',
    'deliverySlot': {
      'date': '2026-11-17',
      'timeSlot': '4:00 PM – 5:00 PM',
      'tierId': 'fixed-time',
      'tierLabel': 'Fixed Time Delivery',
    },
    'orderNotes': 'Please call before arriving',
    'coupon': {'code': 'SWEET100', 'label': '₹100 off', 'discountAmount': 100},
    if (policyClass != null)
      'cancellationPolicy': {
        'version': '1',
        'text': 'Can be cancelled until we start preparing it.',
        'policyClass': policyClass,
        'itemClasses': <Map<String, dynamic>>[],
      },
  };
}
