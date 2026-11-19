import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../../core/utils/view_status.dart';
import '../../../../home_layout/domain/services/promo_banner_picker.dart';
import '../../../../home_layout/domain/usecases/peek_home_layout.dart';
import '../../../domain/usecases/get_catalog.dart';
import 'categories_state.dart';

/// The Categories tab: the shop's groups, and a promo picture borrowed from
/// the home page when the app already holds it (never fetched for this).
class CategoriesCubit extends Cubit<CategoriesState> {
  CategoriesCubit(this._getCatalog, {required PeekHomeLayout peekHomeLayout})
    : _peekHomeLayout = peekHomeLayout,
      super(const CategoriesState());

  final GetCatalog _getCatalog;
  final PeekHomeLayout _peekHomeLayout;

  Future<void> load({bool forceRefresh = false}) async {
    emit(state.copyWith(status: ViewStatus.loading));
    final result = await _getCatalog(forceRefresh);
    if (isClosed) return; // the screen was left mid-request
    final promo = PromoBannerPicker.pick(_peekHomeLayout());
    result.match(
      (failure) => emit(
        state.copyWith(status: ViewStatus.failure, errorMessage: failure.message).withPromo(promo),
      ),
      (catalog) =>
          emit(state.copyWith(status: ViewStatus.success, catalog: catalog).withPromo(promo)),
    );
  }
}
