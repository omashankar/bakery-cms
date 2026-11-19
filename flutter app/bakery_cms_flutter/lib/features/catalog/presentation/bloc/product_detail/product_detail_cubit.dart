import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../domain/entities/product_modules.dart';
import '../../../domain/entities/product_selection.dart';
import '../../../domain/entities/product_weight.dart';
import '../../../domain/usecases/get_product_by_slug.dart';
import '../../../domain/usecases/get_related_products.dart';
import '../../../domain/usecases/record_product_view.dart';
import 'product_detail_state.dart';

class ProductDetailCubit extends Cubit<ProductDetailState> {
  ProductDetailCubit(
    this._getProductBySlug, {
    RecordProductView? recordProductView,
    GetRelatedProducts? getRelatedProducts,
  }) : _recordProductView = recordProductView,
       _getRelatedProducts = getRelatedProducts,
       super(const ProductDetailState());

  final GetProductBySlug _getProductBySlug;

  /// Feeds "Recently viewed" on the home page.
  final RecordProductView? _recordProductView;

  /// "You may also like", from the same cached product list.
  final GetRelatedProducts? _getRelatedProducts;

  /// What the shop has switched on, for the product being loaded and any
  /// change after (see [setModules]).
  ProductModules _modules = ProductModules.all;

  Future<void> load(String slug, {ProductModules? modules}) async {
    if (modules != null) _modules = modules;
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _getProductBySlug(slug);
    if (isClosed) return; // the screen was left mid-request
    result.match(
      (failure) => emit(state.copyWith(status: ViewStatus.failure, errorMessage: failure.message)),
      (product) {
        emit(
          state.copyWith(
            status: ViewStatus.success,
            selection: ProductSelection.initial(product, modules: _modules),
          ),
        );
        _recordProductView?.call(product.slug);
      },
    );
    final product = result.getRight().toNullable();
    final getRelated = _getRelatedProducts;
    if (product == null || getRelated == null) return;
    // After the product is drawn, never before: the row is below the fold.
    final related = (await getRelated(product)).getOrElse((_) => const []);
    if (isClosed || related.isEmpty) return;
    emit(state.copyWith(related: related));
  }

  void selectWeight(ProductWeight weight) => _update((s) => s.copyWith(weight: weight));

  void selectVariant(String groupId, String optionId) =>
      _update((s) => s.copyWith(variantSelections: {...s.variantSelections, groupId: optionId}));

  void setMessage(String message) => _update(
    (s) => s.copyWith(
      message: message.length > ProductSelection.maxMessageLength
          ? message.substring(0, ProductSelection.maxMessageLength)
          : message,
    ),
  );

  /// The shop's modules changed (the settings arrived or were refreshed):
  /// the page re-offers and re-prices what is chosen, keeping the choices.
  void setModules(ProductModules modules) {
    if (modules == _modules) return;
    _modules = modules;
    _update((s) => s.copyWith(modules: modules));
  }

  void setQuantity(int quantity) => _update((s) => s.copyWith(quantity: quantity));

  /// The photo-cake picture, as the upload stands: its URL once the shop has
  /// it, and [pending] while it uploads or after it failed.
  void setPhoto(String? url, {bool pending = false}) {
    final current = state.selection;
    if (current == null) return;
    emit(state.copyWith(selection: current.withPhoto(url), photoPending: pending));
  }

  void _update(ProductSelection Function(ProductSelection current) change) {
    final current = state.selection;
    if (current == null) return;
    emit(state.copyWith(selection: change(current)));
  }
}
