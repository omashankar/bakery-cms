import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/home_feed.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/rail_kind.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/repositories/catalog_repository.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_home_feed.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../catalog_fixtures.dart';

class _MockRepository extends Mock implements CatalogRepository {}

void main() {
  late _MockRepository repository;

  setUp(() => repository = _MockRepository());

  void stubProducts(Either<NetworkFailure, Never>? failure) {
    when(
      () => repository.getProducts(forceRefresh: any(named: 'forceRefresh')),
    ).thenAnswer((_) async => failure ?? const Right(CatalogFixtures.products));
  }

  test('collections come first, then best sellers; empty rails are dropped', () async {
    stubProducts(null);
    when(
      () => repository.getCatalog(forceRefresh: any(named: 'forceRefresh')),
    ).thenAnswer((_) async => const Right(CatalogFixtures.catalog));

    final feed = (await GetHomeFeed(repository)(false)).getOrElse((_) => const HomeFeed());

    expect(feed.rails.map((r) => r.kind), [RailKind.collection, RailKind.bestSellers]);
    expect(feed.categories, [CatalogFixtures.chocolate]);
    expect(feed.allProducts, CatalogFixtures.products);
  });

  test('a failed catalog still shows the products', () async {
    stubProducts(null);
    when(
      () => repository.getCatalog(forceRefresh: any(named: 'forceRefresh')),
    ).thenAnswer((_) async => const Left(ServerFailure()));

    final feed = (await GetHomeFeed(repository)(false)).getOrElse((_) => const HomeFeed());

    expect(feed.categories, isEmpty);
    expect(feed.allProducts, CatalogFixtures.products);
  });

  test('failed products fail the feed', () async {
    stubProducts(const Left(NetworkFailure()));
    when(
      () => repository.getCatalog(forceRefresh: any(named: 'forceRefresh')),
    ).thenAnswer((_) async => const Right(CatalogFixtures.catalog));

    final result = await GetHomeFeed(repository)(false);
    expect(result.getLeft().toNullable(), const NetworkFailure());
  });
}
