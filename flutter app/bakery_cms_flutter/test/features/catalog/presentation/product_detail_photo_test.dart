import 'package:bakery_cms_flutter/core/utils/view_status.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/entities/product_selection.dart';
import 'package:bakery_cms_flutter/features/catalog/domain/usecases/get_product_by_slug.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_detail/product_detail_cubit.dart';
import 'package:bakery_cms_flutter/features/catalog/presentation/bloc/product_detail/product_detail_state.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import '../catalog_fixtures.dart';

class _MockGetProductBySlug extends Mock implements GetProductBySlug {}

void main() {
  const url = CatalogFixtures.photoUrl;
  final loaded = ProductDetailState(
    status: ViewStatus.success,
    selection: ProductSelection.initial(CatalogFixtures.photoCake),
  );

  blocTest<ProductDetailCubit, ProductDetailState>(
    'uploading holds the cart; the uploaded photo joins the selection',
    build: () => ProductDetailCubit(_MockGetProductBySlug()),
    seed: () => loaded,
    act: (cubit) => cubit
      ..setPhoto(null, pending: true)
      ..setPhoto(url),
    expect: () => [
      loaded.copyWith(photoPending: true),
      loaded.copyWith(selection: loaded.selection!.withPhoto(url), photoPending: false),
    ],
    verify: (cubit) => expect(cubit.state.selection!.toCartItem().photoUrl, url),
  );

  blocTest<ProductDetailCubit, ProductDetailState>(
    'removing the photo takes it off the line',
    build: () => ProductDetailCubit(_MockGetProductBySlug()),
    seed: () => loaded.copyWith(selection: loaded.selection!.withPhoto(url)),
    act: (cubit) => cubit.setPhoto(null),
    expect: () => [loaded],
  );
}
