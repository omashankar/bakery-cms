import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/payment_methods.dart';
import 'package:bakery_cms_flutter/features/store/domain/entities/store_config.dart';
import 'package:bakery_cms_flutter/features/store/domain/usecases/get_store_config.dart';
import 'package:bakery_cms_flutter/features/store/presentation/bloc/store_config_cubit.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockGetStoreConfig extends Mock implements GetStoreConfig {}

const _config = StoreConfig(
  siteName: 'Sweet Crumbs Bakery',
  tagline: '',
  logoUrl: '',
  currency: 'INR',
  deliveryFee: 99,
  freeDeliveryThreshold: 999,
  minOrderValue: 0,
  useZoneBasedDelivery: true,
  deliveryLeadDays: 0,
  sameDayCutoff: '14:00',
  deliveryTimeSlots: [],
  deliveryTiers: [],
  giftWrapEnabled: false,
  giftWrapFee: 0,
  giftWrapLabel: '',
  checkoutTerms: '',
  paymentMethods: PaymentMethods(cod: true, upi: false, card: false, razorpay: false),
  maintenanceEnabled: false,
  maintenanceMessage: '',
);

/// Found on a phone: an app opened offline kept "Bakery" as the shop name
/// and had no delivery tiers until it was restarted.
void main() {
  late _MockGetStoreConfig getConfig;
  const fast = [Duration(milliseconds: 10), Duration(milliseconds: 10)];

  setUpAll(() => registerFallbackValue(const NoParams()));
  setUp(() => getConfig = _MockGetStoreConfig());

  test('a failed start-up load is retried until the settings arrive', () async {
    var calls = 0;
    when(() => getConfig(any())).thenAnswer((_) async =>
        ++calls == 1 ? const Left(NetworkFailure()) : const Right(_config));

    final cubit = StoreConfigCubit(getConfig, retryDelays: fast);
    await cubit.load();
    expect(cubit.state.status, ViewStatus.failure);

    final loaded = await cubit.stream
        .firstWhere((s) => s.status.isSuccess)
        .timeout(const Duration(seconds: 2));
    expect(loaded.config, _config);
    await cubit.close();
  });

  test('loadIfNeeded does nothing once the settings are here', () async {
    when(() => getConfig(any())).thenAnswer((_) async => const Right(_config));
    final cubit = StoreConfigCubit(getConfig, retryDelays: fast);
    await cubit.load();
    await cubit.loadIfNeeded();
    verify(() => getConfig(any())).called(1);
    await cubit.close();
  });

  test('closing stops a pending retry', () async {
    when(() => getConfig(any())).thenAnswer((_) async => const Left(NetworkFailure()));
    final cubit = StoreConfigCubit(getConfig, retryDelays: fast);
    await cubit.load();
    await cubit.close();
    await Future<void>.delayed(const Duration(milliseconds: 60));
    verify(() => getConfig(any())).called(1);
  });
}
