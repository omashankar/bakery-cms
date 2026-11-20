import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/store/data/models/public_settings_model.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';
import 'package:bakery_cms_flutter/features/store/domain/usecases/get_store_config.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_cubit.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockGetStoreConfig extends Mock implements GetStoreConfig {}

/// The live `GET /api/settings/public` `data`, trimmed.
final Map<String, dynamic> _settingsJson = {
  'general': {
    'siteName': 'Sweet Crumbs Bakery',
    'siteTagline': 'Freshly baked in Kota, every day',
    'logo': 'https://res.cloudinary.com/x/logo.webp',
    'currency': 'INR',
  },
  'commerce': {
    'deliveryFee': 99,
    'freeDeliveryThreshold': 999,
    'minOrderValue': 0,
    'useZoneBasedDelivery': true,
    'deliveryLeadDays': 0,
    'sameDayCutoff': '14:00',
    'deliveryTimeSlots': ['10:00 AM – 12:00 PM'],
    'deliveryTiers': [
      {
        'id': 'midnight',
        'label': 'Midnight Delivery',
        'description': 'Between 11 PM and midnight',
        'fee': 250,
        'windows': ['11:00 PM – 12:00 AM'],
      },
    ],
    'giftWrapEnabled': true,
    'giftWrapFee': 49,
    'giftWrapLabel': 'Gift wrap',
    'checkoutTerms': 'By placing this order…',
    'paymentMethods': {'cod': true, 'upi': true, 'card': true, 'razorpay': true},
  },
  'maintenance': {'isEnabled': false, 'message': ''},
};

void main() {
  final config = PublicSettingsModel.fromJson(_settingsJson).toEntity();

  test('public settings parse into the store config', () {
    expect(config.siteName, 'Sweet Crumbs Bakery');
    expect(config.useZoneBasedDelivery, isTrue);
    expect(config.deliveryTiers.single.fee, 250);
    expect(config.paymentMethods.online, isTrue);
    expect(config.sameDayCutoff, '14:00');
  });

  test('missing payment settings fall back to cash on delivery only', () {
    final commerce = {..._settingsJson['commerce'] as Map<String, dynamic>}
      ..remove('paymentMethods');
    final fallback =
        PublicSettingsModel.fromJson({..._settingsJson, 'commerce': commerce}).toEntity();
    expect(fallback.paymentMethods.cod, isTrue);
    expect(fallback.paymentMethods.online, isFalse);
  });

  group('StoreConfigCubit', () {
    late _MockGetStoreConfig getConfig;

    setUpAll(() => registerFallbackValue(const NoParams()));
    setUp(() => getConfig = _MockGetStoreConfig());

    blocTest<StoreConfigCubit, StoreConfigState>(
      'loads the config',
      setUp: () => when(() => getConfig(any())).thenAnswer((_) async => Right<Never, StoreConfig>(config)),
      build: () => StoreConfigCubit(getConfig),
      act: (cubit) => cubit.load(),
      expect: () => [
        const StoreConfigState(status: ViewStatus.loading),
        StoreConfigState(status: ViewStatus.success, config: config),
      ],
    );

    blocTest<StoreConfigCubit, StoreConfigState>(
      'reports a failure',
      setUp: () => when(() => getConfig(any())).thenAnswer((_) async => const Left(NetworkFailure())),
      build: () => StoreConfigCubit(getConfig),
      act: (cubit) => cubit.load(),
      expect: () => [
        const StoreConfigState(status: ViewStatus.loading),
        StoreConfigState(status: ViewStatus.failure, errorMessage: const NetworkFailure().message),
      ],
    );
  });
}
