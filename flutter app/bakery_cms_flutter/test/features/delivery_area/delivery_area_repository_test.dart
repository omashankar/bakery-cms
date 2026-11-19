import 'package:bakery_cms_flutter/core/constants/storage_keys.dart';
import 'package:bakery_cms_flutter/core/error/cache_failure.dart';
import 'package:bakery_cms_flutter/core/error/network_exception.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/features/delivery_area/data/datasources/delivery_area_local_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/delivery_area/data/datasources/delivery_area_remote_data_source.dart';
import 'package:bakery_cms_flutter/features/delivery_area/data/models/delivery_area_model.dart';
import 'package:bakery_cms_flutter/features/delivery_area/data/repositories/delivery_area_repository_impl.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_area.dart';
import 'package:bakery_cms_flutter/features/delivery_area/domain/entities/delivery_verdict.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockRemote extends Mock implements DeliveryAreaRemoteDataSource {}

/// The chosen PIN code survives a restart, and a check saves nothing.
void main() {
  late _MockRemote remote;

  const kota = DeliveryArea(
    pincode: '324002',
    verdict: DeliveryVerdict.eligible,
    city: 'Kota',
    charge: 99,
    minDeliveryDays: 1,
  );

  Future<DeliveryAreaRepositoryImpl> repository([Map<String, Object> kept = const {}]) async {
    SharedPreferences.setMockInitialValues(kept);
    final prefs = await SharedPreferences.getInstance();
    return DeliveryAreaRepositoryImpl(
      remote: remote,
      local: DeliveryAreaLocalDataSourceImpl(prefs),
    );
  }

  setUp(() => remote = _MockRemote());

  test('nothing kept: none chosen', () async {
    final repo = await repository();
    expect((await repo.saved()).getRight().toNullable(), isNull);
  });

  test('a saved area reads back on the next launch, from a fresh repository', () async {
    final first = await repository();
    await first.save(kota);
    final prefs = await SharedPreferences.getInstance();
    final next = DeliveryAreaRepositoryImpl(
      remote: remote,
      local: DeliveryAreaLocalDataSourceImpl(prefs),
    );
    expect((await next.saved()).getRight().toNullable(), kota);
  });

  test('what cannot be read is a cache failure, not a crash', () async {
    final repo = await repository({StorageKeys.deliveryArea: '{not json'});
    expect((await repo.saved()).getLeft().toNullable(), isA<CacheFailure>());
  });

  test('a check returns the answer and keeps nothing', () async {
    when(() => remote.check('324002')).thenAnswer((_) async => DeliveryAreaModel.fromEntity(kota));
    final repo = await repository();
    expect((await repo.check('324002')).getRight().toNullable(), kota);
    expect((await repo.saved()).getRight().toNullable(), isNull);
  });

  test('a check without a network is a network failure', () async {
    when(() => remote.check(any())).thenThrow(const NetworkException());
    final repo = await repository();
    expect((await repo.check('324002')).getLeft().toNullable(), isA<NetworkFailure>());
  });
}
