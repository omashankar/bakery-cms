import 'dart:async';

import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/home_feed.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_home_feed.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/watch_recently_viewed.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/home/home_bloc.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/home/home_event.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/home/home_state.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/home_layout.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/entities/products_section.dart';
import 'package:bakery_cms_flutter/features/home_layout/domain/usecases/get_home_layout.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../catalog_fixtures.dart';

class _MockGetHomeFeed extends Mock implements GetHomeFeed {}

class _MockGetHomeLayout extends Mock implements GetHomeLayout {}

class _MockWatchRecentlyViewed extends Mock implements WatchRecentlyViewed {}

void main() {
  late _MockGetHomeFeed getHomeFeed;
  late _MockGetHomeLayout getHomeLayout;
  late _MockWatchRecentlyViewed watchRecentlyViewed;
  const feed = HomeFeed(allProducts: CatalogFixtures.products);
  const failure = NetworkFailure();
  const layout = HomeLayout(
    updatedAt: '2026-11-18T00:00:00.000Z',
    sections: [
      ProductsSection(id: 'best', productSlugs: ['chocolate-truffle']),
    ],
  );

  HomeBloc build() => HomeBloc(
    getHomeFeed: getHomeFeed,
    getHomeLayout: getHomeLayout,
    watchRecentlyViewed: watchRecentlyViewed,
  );

  setUp(() {
    getHomeFeed = _MockGetHomeFeed();
    getHomeLayout = _MockGetHomeLayout();
    watchRecentlyViewed = _MockWatchRecentlyViewed();
    when(() => getHomeLayout(any())).thenAnswer((_) async => const Right(HomeLayout()));
    when(() => watchRecentlyViewed()).thenAnswer((_) => Stream.value(const []));
  });

  blocTest<HomeBloc, HomeState>(
    'started → loading, then the feed',
    setUp: () => when(() => getHomeFeed(false)).thenAnswer((_) async => const Right(feed)),
    build: build,
    act: (bloc) => bloc.add(const HomeStarted()),
    expect: () => const [
      HomeState(status: ViewStatus.loading),
      HomeState(status: ViewStatus.success, feed: feed),
    ],
  );

  blocTest<HomeBloc, HomeState>(
    'the shop\'s published layout arrives with the feed',
    setUp: () {
      when(() => getHomeFeed(false)).thenAnswer((_) async => const Right(feed));
      when(() => getHomeLayout(false)).thenAnswer((_) async => const Right(layout));
    },
    build: build,
    act: (bloc) => bloc.add(const HomeStarted()),
    expect: () => const [
      HomeState(status: ViewStatus.loading),
      HomeState(status: ViewStatus.success, feed: feed, layout: layout),
    ],
  );

  blocTest<HomeBloc, HomeState>(
    'a layout that cannot be read is not an error: the app\'s own rows show',
    setUp: () {
      when(() => getHomeFeed(false)).thenAnswer((_) async => const Right(feed));
      when(() => getHomeLayout(false)).thenAnswer((_) async => const Left(failure));
    },
    build: build,
    act: (bloc) => bloc.add(const HomeStarted()),
    expect: () => const [
      HomeState(status: ViewStatus.loading),
      HomeState(status: ViewStatus.success, feed: feed),
    ],
  );

  blocTest<HomeBloc, HomeState>(
    'a refresh whose layout fails keeps the layout already shown',
    setUp: () {
      when(() => getHomeFeed(true)).thenAnswer((_) async => const Right(feed));
      when(() => getHomeLayout(true)).thenAnswer((_) async => const Left(failure));
    },
    build: build,
    seed: () => const HomeState(status: ViewStatus.success, feed: feed, layout: layout),
    act: (bloc) => bloc.add(const HomeRefreshed()),
    expect: () => const [
      HomeState(status: ViewStatus.loading, feed: feed, layout: layout),
      HomeState(status: ViewStatus.success, feed: feed, layout: layout),
    ],
  );

  blocTest<HomeBloc, HomeState>(
    'opening a product updates Recently viewed on the home tab',
    setUp: () {
      when(() => getHomeFeed(false)).thenAnswer((_) async => const Right(feed));
      when(() => watchRecentlyViewed()).thenAnswer(
        (_) => Stream.fromIterable(const [
          <String>[],
          ['chocolate-truffle'],
        ]),
      );
    },
    build: build,
    act: (bloc) => bloc.add(const HomeStarted()),
    expect: () => const [
      HomeState(status: ViewStatus.loading),
      HomeState(status: ViewStatus.success, feed: feed),
      HomeState(status: ViewStatus.success, feed: feed, recentSlugs: ['chocolate-truffle']),
    ],
  );

  blocTest<HomeBloc, HomeState>(
    'failure carries the customer-facing message',
    setUp: () => when(() => getHomeFeed(false)).thenAnswer((_) async => const Left(failure)),
    build: build,
    act: (bloc) => bloc.add(const HomeStarted()),
    expect: () => [
      const HomeState(status: ViewStatus.loading),
      HomeState(status: ViewStatus.failure, errorMessage: failure.message),
    ],
  );

  blocTest<HomeBloc, HomeState>(
    'a failed refresh keeps the feed on screen',
    setUp: () => when(() => getHomeFeed(true)).thenAnswer((_) async => const Left(failure)),
    build: build,
    seed: () => const HomeState(status: ViewStatus.success, feed: feed),
    act: (bloc) => bloc.add(const HomeRefreshed()),
    expect: () => [
      const HomeState(status: ViewStatus.loading, feed: feed),
      HomeState(status: ViewStatus.failure, feed: feed, errorMessage: failure.message),
    ],
  );

  blocTest<HomeBloc, HomeState>(
    'an empty shop is a success with an empty feed (the page shows EmptyView)',
    setUp: () => when(() => getHomeFeed(false)).thenAnswer((_) async => const Right(HomeFeed())),
    build: build,
    act: (bloc) => bloc.add(const HomeStarted()),
    expect: () => const [
      HomeState(status: ViewStatus.loading),
      HomeState(status: ViewStatus.success),
    ],
    verify: (bloc) => expect(bloc.state.feed.isEmpty, isTrue),
  );
}
