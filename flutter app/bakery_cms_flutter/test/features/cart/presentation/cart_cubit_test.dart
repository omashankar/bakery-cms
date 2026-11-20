import 'package:bakery_cms_flutter/core/error/cache_failure.dart';
import 'package:bakery_cms_flutter/core/usecase/no_params.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart.dart';
import 'package:bakery_cms_flutter/features/cart/domain/entities/cart_item.dart';
import 'package:bakery_cms_flutter/features/cart/domain/usecases/load_cart.dart';
import 'package:bakery_cms_flutter/features/cart/domain/usecases/save_cart.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_cubit.dart';
import 'package:bakery_cms_flutter/features/cart/presentation/bloc/cart_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

class _MockLoadCart extends Mock implements LoadCart {}

class _MockSaveCart extends Mock implements SaveCart {}

const _item = CartItem(
  id: 'cake|1 Kg',
  productSlug: 'cake',
  name: 'Cake',
  image: '',
  unitPrice: 500,
  quantity: 1,
  weight: '1 Kg',
);

void main() {
  late _MockLoadCart loadCart;
  late _MockSaveCart saveCart;

  setUpAll(() {
    registerFallbackValue(const NoParams());
    registerFallbackValue(const Cart());
  });

  setUp(() {
    loadCart = _MockLoadCart();
    saveCart = _MockSaveCart();
    when(() => saveCart(any())).thenAnswer((_) async => const Right(unit));
  });

  CartCubit build() => CartCubit(loadCart: loadCart, saveCart: saveCart);

  blocTest<CartCubit, CartState>(
    'load emits the saved cart',
    setUp: () => when(() => loadCart(any())).thenAnswer((_) async => const Right(Cart([_item]))),
    build: build,
    act: (cubit) => cubit.load(),
    expect: () => const [
      CartState(status: ViewStatus.loading),
      CartState(status: ViewStatus.success, cart: Cart([_item])),
    ],
  );

  blocTest<CartCubit, CartState>(
    'load failure emits the failure message',
    setUp: () => when(() => loadCart(any())).thenAnswer((_) async => const Left(CacheFailure())),
    build: build,
    act: (cubit) => cubit.load(),
    expect: () => [
      const CartState(status: ViewStatus.loading),
      CartState(status: ViewStatus.failure, errorMessage: const CacheFailure().message),
    ],
  );

  blocTest<CartCubit, CartState>(
    'add shows the line at once, names it, and saves',
    build: build,
    act: (cubit) => cubit.add(_item),
    expect: () => const [
      CartState(status: ViewStatus.success, cart: Cart([_item]), lastAddedName: 'Cake'),
    ],
    verify: (_) => verify(() => saveCart(const Cart([_item]))).called(1),
  );

  blocTest<CartCubit, CartState>(
    'Buy now adds without the "added to cart" message',
    build: build,
    act: (cubit) => cubit.add(_item, announce: false),
    expect: () => const [CartState(status: ViewStatus.success, cart: Cart([_item]))],
  );

  blocTest<CartCubit, CartState>(
    'a failed save keeps the cart and reports the failure',
    setUp: () => when(() => saveCart(any())).thenAnswer((_) async => const Left(CacheFailure())),
    build: build,
    seed: () => const CartState(status: ViewStatus.success, cart: Cart([_item])),
    act: (cubit) => cubit.remove(_item.id),
    expect: () => [
      const CartState(status: ViewStatus.success),
      CartState(status: ViewStatus.success, errorMessage: const CacheFailure().message),
    ],
  );

  blocTest<CartCubit, CartState>(
    'clear empties the cart',
    build: build,
    seed: () => const CartState(status: ViewStatus.success, cart: Cart([_item])),
    act: (cubit) => cubit.clear(),
    expect: () => const [CartState(status: ViewStatus.success)],
  );
}
