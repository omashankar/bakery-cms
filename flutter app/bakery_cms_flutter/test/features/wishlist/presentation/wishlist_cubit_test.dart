import 'dart:async';

import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/remove_from_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/toggle_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/domain/usecases/watch_wishlist.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_cubit.dart';
import 'package:bakery_cms_flutter/features/wishlist/presentation/bloc/wishlist_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockWatchWishlist extends Mock implements WatchWishlist {}

class _MockToggleWishlist extends Mock implements ToggleWishlist {}

class _MockRemoveFromWishlist extends Mock implements RemoveFromWishlist {}

void main() {
  group('WishlistCubit', () {
    late _MockWatchWishlist watch;
    late _MockToggleWishlist toggle;
    late _MockRemoveFromWishlist remove;
    late StreamController<List<String>> saved;

    setUp(() {
      watch = _MockWatchWishlist();
      toggle = _MockToggleWishlist();
      remove = _MockRemoveFromWishlist();
      saved = StreamController<List<String>>.broadcast();
      when(() => watch()).thenAnswer((_) => saved.stream);
      when(() => toggle(any())).thenAnswer((_) async {});
      when(() => remove(any())).thenAnswer((_) async {});
    });

    tearDown(() => saved.close());

    WishlistCubit build() =>
        WishlistCubit(watchWishlist: watch, toggleWishlist: toggle, removeFromWishlist: remove);

    test('starts empty', () {
      expect(build().state, const WishlistState());
    });

    blocTest<WishlistCubit, WishlistState>(
      'follows the saved list: what is on the phone, then every change',
      build: build,
      act: (cubit) async {
        cubit.start();
        saved.add(['a']);
        await Future<void>.delayed(Duration.zero);
        saved.add(['b', 'a']);
      },
      expect: () => const [
        WishlistState(slugs: ['a']),
        WishlistState(slugs: ['b', 'a']),
      ],
    );

    blocTest<WishlistCubit, WishlistState>(
      'a second start does not listen twice',
      build: build,
      act: (cubit) {
        cubit
          ..start()
          ..start();
      },
      verify: (_) => verify(() => watch()).called(1),
    );

    blocTest<WishlistCubit, WishlistState>(
      'isSaved reads the current list',
      build: build,
      act: (cubit) async {
        cubit.start();
        saved.add(['a']);
      },
      verify: (cubit) {
        expect(cubit.isSaved('a'), isTrue);
        expect(cubit.isSaved('b'), isFalse);
      },
    );

    blocTest<WishlistCubit, WishlistState>(
      'toggle and remove go to their use cases',
      build: build,
      act: (cubit) async {
        await cubit.toggle('a');
        await cubit.remove('b');
      },
      verify: (_) {
        verify(() => toggle('a')).called(1);
        verify(() => remove('b')).called(1);
      },
    );

    test('closing stops listening', () async {
      final cubit = build()..start();
      expect(saved.hasListener, isTrue);
      await cubit.close();
      expect(saved.hasListener, isFalse);
    });
  });
}
