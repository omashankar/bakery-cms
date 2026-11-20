import 'dart:async';
import 'dart:convert';

import 'package:bakery_cms_flutter/core/constants/storage_keys.dart';
import 'package:bakery_cms_flutter/features/auth/presentation/widgets/session_end_wiper.dart';
import 'package:bakery_cms_flutter/features/cart/data/datasources/cart_local_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/cart/data/repositories/cart_repository_impl.dart';
import 'package:bakery_cms_flutter/features/cart/domain/usecases/load_cart.dart';
import 'package:bakery_cms_flutter/features/cart/domain/usecases/save_cart.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_cubit.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_state.dart';
import 'package:bakery_cms_flutter/features/catalog/data/datasources/recently_viewed_local_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/wishlist/data/datasources/wishlist_local_data_source_impl.dart';
import 'package:bakery_cms_flutter/features/wishlist/data/repositories/wishlist_repository_impl.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _MockCartCubit extends MockCubit<CartState> implements CartCubit {}

/// When a customer's session ends on this phone, the phone forgets what it
/// held for them, store by store, exactly as the website's
/// `clearLocalCustomerData` does: the cart and the wishlist go; the delivery
/// PIN code and recently viewed products stay.
void main() {
  const cartLine = {
    'id': 'line-1',
    'productSlug': 'choco-truffle',
    'name': 'Choco Truffle',
    'image': '',
    'unitPrice': 650,
    'quantity': 1,
  };
  const deliveryArea = '{"pincode":"324002","status":"eligible"}';
  const wishlistKey = WishlistLocalDataSourceImpl.key;

  late SharedPreferences prefs;
  late StreamController<void> ended;

  setUp(() async {
    SharedPreferences.setMockInitialValues({
      StorageKeys.cart: jsonEncode([cartLine]),
      wishlistKey: ['choco-truffle', 'red-velvet'],
      'recently_viewed_products': ['choco-truffle'],
      StorageKeys.deliveryArea: deliveryArea,
    });
    prefs = await SharedPreferences.getInstance();
    ended = StreamController<void>.broadcast();
  });

  tearDown(() => ended.close());

  group('the stores, on real (mock) SharedPreferences', () {
    test('the wishlist wipes itself, in memory and on disk, when a session ends', () async {
      final wishlist = WishlistRepositoryImpl(
        WishlistLocalDataSourceImpl(prefs),
        sessionEnded: ended.stream,
      );
      expect(wishlist.slugs, hasLength(2));
      final announced = expectLater(wishlist.changes, emits(isEmpty));

      ended.add(null);
      await announced;
      await Future<void>.delayed(Duration.zero);

      expect(wishlist.slugs, isEmpty);
      expect(prefs.getStringList(wishlistKey) ?? const <String>[], isEmpty);
      await wishlist.dispose();
    });

    test('the wishlist is left alone until a session ends', () async {
      final wishlist = WishlistRepositoryImpl(
        WishlistLocalDataSourceImpl(prefs),
        sessionEnded: ended.stream,
      );
      await Future<void>.delayed(Duration.zero);
      expect(wishlist.slugs, hasLength(2));
      expect(prefs.getStringList(wishlistKey), hasLength(2));
      await wishlist.dispose();
    });

    test('CartCubit.clear (what the wiper calls) empties the cart on screen and on disk', () async {
      final repository = CartRepositoryImpl(CartLocalDataSourceImpl(prefs));
      final cart = CartCubit(loadCart: LoadCart(repository), saveCart: SaveCart(repository));
      await cart.load();
      expect(cart.state.cart.items, isNotEmpty, reason: 'the fixture cart must load');

      await cart.clear();

      expect(cart.state.cart.items, isEmpty);
      expect(jsonDecode(prefs.getString(StorageKeys.cart) ?? '[]'), isEmpty);
      await cart.close();
    });

    test(
      'the delivery PIN code and recently viewed products are kept, as on the website',
      () async {
        final wishlist = WishlistRepositoryImpl(
          WishlistLocalDataSourceImpl(prefs),
          sessionEnded: ended.stream,
        );
        ended.add(null);
        await Future<void>.delayed(Duration.zero);

        expect(prefs.getString(StorageKeys.deliveryArea), deliveryArea);
        expect(RecentlyViewedLocalDataSourceImpl(prefs).read(), ['choco-truffle']);
        await wishlist.dispose();
      },
    );
  });

  group('SessionEndWiper', () {
    testWidgets('empties the cart each time a session ends, and not before', (tester) async {
      final cart = _MockCartCubit();
      when(() => cart.state).thenReturn(const CartState());
      when(cart.clear).thenAnswer((_) async {});

      await tester.pumpWidget(
        BlocProvider<CartCubit>.value(
          value: cart,
          child: SessionEndWiper(sessionEnded: ended.stream, child: const SizedBox()),
        ),
      );
      await tester.pump();
      verifyNever(cart.clear);

      ended.add(null);
      await tester.pump();
      verify(cart.clear).called(1);

      ended.add(null);
      await tester.pump();
      verify(cart.clear).called(1);
    });

    testWidgets('stops listening once it is gone', (tester) async {
      final cart = _MockCartCubit();
      when(() => cart.state).thenReturn(const CartState());
      when(cart.clear).thenAnswer((_) async {});

      await tester.pumpWidget(
        BlocProvider<CartCubit>.value(
          value: cart,
          child: SessionEndWiper(sessionEnded: ended.stream, child: const SizedBox()),
        ),
      );
      await tester.pumpWidget(const SizedBox());
      expect(ended.hasListener, isFalse);
    });
  });
}
