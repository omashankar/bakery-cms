import 'package:bakery_cms_flutter/core/constants/app_strings.dart';
import 'package:bakery_cms_flutter/core/error/server_failure.dart';
import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_selection.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_product_by_slug.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_detail/product_detail_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_detail/product_detail_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fpdart/fpdart.dart';
import 'package:mocktail/mocktail.dart';

import '../catalog_fixtures.dart';

class _MockGetProductBySlug extends Mock implements GetProductBySlug {}

void main() {
  late _MockGetProductBySlug getProduct;
  const cake = CatalogFixtures.truffleCake;
  final initial = ProductSelection.initial(cake);

  setUp(() => getProduct = _MockGetProductBySlug());

  blocTest<ProductDetailCubit, ProductDetailState>(
    'load emits the product with its default choices',
    setUp: () => when(() => getProduct(cake.slug)).thenAnswer((_) async => const Right(cake)),
    build: () => ProductDetailCubit(getProduct),
    act: (cubit) => cubit.load(cake.slug),
    expect: () => [
      const ProductDetailState(status: ViewStatus.loading),
      ProductDetailState(status: ViewStatus.success, selection: initial),
    ],
  );

  blocTest<ProductDetailCubit, ProductDetailState>(
    'an unknown slug is a failure with a friendly message',
    setUp: () => when(
      () => getProduct('nope'),
    ).thenAnswer((_) async => const Left(ServerFailure(AppStrings.errorNotFound))),
    build: () => ProductDetailCubit(getProduct),
    act: (cubit) => cubit.load('nope'),
    expect: () => const [
      ProductDetailState(status: ViewStatus.loading),
      ProductDetailState(status: ViewStatus.failure, errorMessage: AppStrings.errorNotFound),
    ],
  );

  blocTest<ProductDetailCubit, ProductDetailState>(
    'choosing a weight and a variant updates the selection',
    build: () => ProductDetailCubit(getProduct),
    seed: () => ProductDetailState(status: ViewStatus.success, selection: initial),
    act: (cubit) => cubit
      ..selectWeight(cake.weights[1])
      ..selectVariant('base', 'eggless')
      ..setQuantity(3),
    verify: (cubit) {
      final selection = cubit.state.selection!;
      expect(selection.weight, cake.weights[1]);
      expect(selection.variantSelections, {'base': 'eggless'});
      expect(selection.quantity, 3);
      expect(selection.lineTotal, (999 + 50) * 3);
    },
  );

  blocTest<ProductDetailCubit, ProductDetailState>(
    'a message is capped at the API limit',
    build: () => ProductDetailCubit(getProduct),
    seed: () => ProductDetailState(status: ViewStatus.success, selection: initial),
    act: (cubit) => cubit.setMessage('x' * 600),
    verify: (cubit) =>
        expect(cubit.state.selection!.message.length, ProductSelection.maxMessageLength),
  );
}
