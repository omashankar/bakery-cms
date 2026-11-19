import 'dart:async';

import 'package:bakery_cms_flutter/core/error/failure.dart';
import 'package:bakery_cms_flutter/core/error/network_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/get_wishlist_products.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/watch_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_page_cubit.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_page_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../../catalog/catalog_fixtures.dart';

class _MockWatchWishlist extends Mock implements WatchWishlist {}

class _MockGetWishlistProducts extends Mock implements GetWishlistProducts {}

void main() {
  group('WishlistPageCubit', () {
    late _MockWatchWishlist watch;
    late _MockGetWishlistProducts getProducts;
    late StreamController<List<String>> saved;

    const cake = CatalogFixtures.truffleCake;
    const pastry = CatalogFixtures.pastry;
    final both = [cake.slug, pastry.slug];
    final justPastry = [pastry.slug];

    setUp(() {
      watch = _MockWatchWishlist();
      getProducts = _MockGetWishlistProducts();
      saved = StreamController<List<String>>.broadcast();
      when(() => watch()).thenAnswer((_) => saved.stream);
      when(() => getProducts(both)).thenAnswer((_) async => const Right([cake, pastry]));
      when(() => getProducts(justPastry)).thenAnswer((_) async => const Right([pastry]));
      when(() => getProducts(const [])).thenAnswer((_) async => const Right([]));
    });

    tearDown(() => saved.close());

    WishlistPageCubit build() =>
        WishlistPageCubit(watchWishlist: watch, getWishlistProducts: getProducts);

    blocTest<WishlistPageCubit, WishlistPageState>(
      'shows the saved products, then follows every heart tapped elsewhere',
      build: build,
      act: (cubit) async {
        cubit.start();
        saved.add(both);
        await Future<void>.delayed(Duration.zero);
        saved.add(justPastry);
        await Future<void>.delayed(Duration.zero);
        saved.add(const []);
      },
      expect: () => const [
        WishlistPageState(status: ViewStatus.loading),
        WishlistPageState(status: ViewStatus.success, products: [cake, pastry]),
        WishlistPageState(status: ViewStatus.success, products: [pastry]),
        WishlistPageState(status: ViewStatus.success),
      ],
    );

    blocTest<WishlistPageCubit, WishlistPageState>(
      'a catalogue that cannot load is an error, and retry tries again',
      setUp: () {
        var calls = 0;
        when(() => getProducts(both)).thenAnswer(
          (_) async => calls++ == 0 ? const Left(NetworkFailure()) : const Right([cake, pastry]),
        );
      },
      build: build,
      act: (cubit) async {
        cubit.start();
        saved.add(both);
        await Future<void>.delayed(Duration.zero);
        await cubit.retry();
      },
      expect: () => [
        const WishlistPageState(status: ViewStatus.loading),
        WishlistPageState(status: ViewStatus.failure, errorMessage: const NetworkFailure().message),
        const WishlistPageState(status: ViewStatus.loading),
        const WishlistPageState(status: ViewStatus.success, products: [cake, pastry]),
      ],
    );

    blocTest<WishlistPageCubit, WishlistPageState>(
      'a slow older lookup never overwrites a newer one',
      setUp: () {
        final slow = Completer<Either<Failure, List<Product>>>();
        when(() => getProducts(both)).thenAnswer((_) => slow.future);
        when(() => getProducts(justPastry)).thenAnswer((_) async {
          // The newer list answers first; the older one only afterwards.
          scheduleMicrotask(() => slow.complete(const Right([cake, pastry])));
          return const Right([pastry]);
        });
      },
      build: build,
      act: (cubit) async {
        cubit.start();
        saved.add(both);
        await Future<void>.delayed(Duration.zero);
        saved.add(justPastry);
        await Future<void>.delayed(const Duration(milliseconds: 10));
      },
      expect: () => const [
        WishlistPageState(status: ViewStatus.loading),
        WishlistPageState(status: ViewStatus.success, products: [pastry]),
      ],
    );

    test('closing stops listening', () async {
      final cubit = build()..start();
      expect(saved.hasListener, isTrue);
      await cubit.close();
      expect(saved.hasListener, isFalse);
    });
  });
}
